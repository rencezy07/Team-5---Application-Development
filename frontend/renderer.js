// PixelLab Pro - Modern Photoshop-style Image Editor
// Professional interface with undo/redo, real-time preview, and smooth interactions

class ImageEditor {
    constructor() {
        this.backendUrl = "http://localhost:8000";
        this.currentTool = 'select';
        this.currentImage = null;
        this.originalImage = null;
        this.history = [];
        this.historyIndex = -1;
        this.zoomLevel = 1.0;
        
        this.initializeElements();
        this.setupEventListeners();
        this.updateUI();
    }

    initializeElements() {
        // Canvas elements
        this.canvasImage = document.getElementById('canvasImage');
        this.canvasContent = document.getElementById('canvasContent');
        this.canvasViewport = document.getElementById('canvasViewport');
        this.dropZone = document.getElementById('dropZone');
        
        // Panels
        this.propertiesContent = document.getElementById('propertiesContent');
        this.propertiesHeader = document.getElementById('propertiesHeader');
        this.historyList = document.getElementById('historyList');
        
        // Controls
        this.fileInput = document.getElementById('fileInput');
        this.loadingOverlay = document.getElementById('loadingOverlay');
        this.zoomDisplay = document.getElementById('zoomLevel');
        
        // Comparison elements
        this.comparisonContainer = document.getElementById('comparisonContainer');
        this.originalComparisonImage = document.getElementById('originalComparisonImage');
        this.processedComparisonImage = document.getElementById('processedComparisonImage');
        
        // Tool buttons
        this.toolButtons = document.querySelectorAll('.tool-button');
        
        // Menu items
        this.fileMenu = document.getElementById('fileMenu');
        this.editMenu = document.getElementById('editMenu');
    }

    setupEventListeners() {
        // File handling
        this.dropZone.addEventListener('click', () => this.fileInput.click());
        this.dropZone.addEventListener('dragover', this.handleDragOver.bind(this));
        this.dropZone.addEventListener('dragleave', this.handleDragLeave.bind(this));
        this.dropZone.addEventListener('drop', this.handleDrop.bind(this));
        this.fileInput.addEventListener('change', this.handleFileSelect.bind(this));

        // Tool selection
        this.toolButtons.forEach(btn => {
            btn.addEventListener('click', () => this.selectTool(btn.dataset.tool));
        });

        // Zoom controls
        document.getElementById('zoomIn').addEventListener('click', () => this.zoom(1.2));
        document.getElementById('zoomOut').addEventListener('click', () => this.zoom(0.8));
        document.getElementById('zoomFit').addEventListener('click', () => this.zoomToFit());

        // Undo/Redo
        document.getElementById('undoBtn').addEventListener('click', () => this.undo());
        document.getElementById('redoBtn').addEventListener('click', () => this.redo());

        // Menu items
        this.fileMenu.addEventListener('click', () => this.showFileMenu());
        this.editMenu.addEventListener('click', () => this.showEditMenu());

        // History
        document.getElementById('clearHistory').addEventListener('click', () => this.clearHistory());

        // New feature buttons
        document.getElementById('batchBtn').addEventListener('click', () => this.showBatchModal());
        document.getElementById('compareBtn').addEventListener('click', () => this.showComparison());
        document.getElementById('exitCompareBtn').addEventListener('click', () => this.exitComparison());
        document.getElementById('exportBtn').addEventListener('click', () => this.showExportModal());

        // Batch processing modal
        document.getElementById('closeBatchModal').addEventListener('click', () => this.hideBatchModal());
        document.getElementById('cancelBatch').addEventListener('click', () => this.hideBatchModal());
        document.getElementById('batchDropZone').addEventListener('click', () => this.batchFileInput.click());
        document.getElementById('batchDropZone').addEventListener('dragover', this.handleBatchDragOver.bind(this));
        document.getElementById('batchDropZone').addEventListener('dragleave', this.handleBatchDragLeave.bind(this));
        document.getElementById('batchDropZone').addEventListener('drop', this.handleBatchDrop.bind(this));
        document.getElementById('processBatch').addEventListener('click', () => this.processBatch());

        // Export modal
        document.getElementById('closeExportModal').addEventListener('click', () => this.hideExportModal());
        document.getElementById('cancelExport').addEventListener('click', () => this.hideExportModal());
        document.getElementById('confirmExport').addEventListener('click', () => this.exportImage());
        document.getElementById('exportFormat').addEventListener('change', () => this.updateExportOptions());
        document.getElementById('exportQuality').addEventListener('input', (e) => {
            document.getElementById('qualityValue').textContent = e.target.value;
        });

        // Batch results modal
        document.getElementById('closeBatchResults').addEventListener('click', () => this.hideBatchResultsModal());
        document.getElementById('closeBatchResultsBtn').addEventListener('click', () => this.hideBatchResultsModal());
        document.getElementById('downloadBatchResults').addEventListener('click', () => this.downloadBatchResults());

        // Initialize new elements
        this.batchFileInput = document.getElementById('batchFileInput');
        this.batchFileInput.addEventListener('change', this.handleBatchFileSelect.bind(this));
        this.batchFiles = [];
        this.batchResults = null;

        // Keyboard shortcuts
        document.addEventListener('keydown', this.handleKeyboard.bind(this));
    }

    handleDragOver(e) {
        e.preventDefault();
        this.dropZone.classList.add('dragover');
    }

    handleDragLeave(e) {
        e.preventDefault();
        this.dropZone.classList.remove('dragover');
    }

    handleDrop(e) {
        e.preventDefault();
        this.dropZone.classList.remove('dragover');
        
        const files = e.dataTransfer.files;
        if (files.length > 0 && files[0].type.startsWith('image/')) {
            this.loadImage(files[0]);
        }
    }

    handleFileSelect(e) {
        const file = e.target.files[0];
        if (file && file.type.startsWith('image/')) {
            this.loadImage(file);
        }
    }

    async loadImage(file) {
        this.showLoading(true);
        
        try {
            // Store original file
            this.originalImage = file;
            this.currentImage = file;
            
            // Display image
            const reader = new FileReader();
            reader.onload = (e) => {
                this.canvasImage.src = e.target.result;
                this.canvasImage.style.display = 'block';
                this.dropZone.style.display = 'none';
                this.zoomToFit();
                this.addToHistory('Original Image', e.target.result);
                this.updateUI();
            };
            reader.readAsDataURL(file);
            
        } catch (error) {
            console.error('Error loading image:', error);
            this.showNotification('Error loading image', 'error');
        } finally {
            this.showLoading(false);
        }
    }

    selectTool(toolName) {
        // Exit comparison mode when switching tools
        if (this.canvasContent.classList.contains('comparison-mode')) {
            this.exitComparison();
        }
        
        this.currentTool = toolName;
        
        // Update tool button states
        this.toolButtons.forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tool === toolName);
        });
        
        // Update properties panel
        this.updatePropertiesPanel();
        this.updateUI();
    }

    updatePropertiesPanel() {
        const toolConfigs = {
            select: {
                title: 'Selection Tool',
                content: `
                    <div class="control-group">
                        <label class="control-label">Selection Options</label>
                        <p style="color: var(--text-muted); font-size: 14px;">
                            Click and drag to select areas of the image.
                        </p>
                    </div>
                `
            },
            crop: {
                title: 'Crop Tool',
                content: `
                    <div class="control-group">
                        <label class="control-label">Crop Settings</label>
                        <div class="slider-control">
                            <span style="width: 60px; font-size: 12px;">Width:</span>
                            <input type="number" id="cropWidth" value="200" class="slider-value" style="width: 80px;">
                        </div>
                        <div class="slider-control" style="margin-top: 8px;">
                            <span style="width: 60px; font-size: 12px;">Height:</span>
                            <input type="number" id="cropHeight" value="200" class="slider-value" style="width: 80px;">
                        </div>
                        <div class="button-group">
                            <button class="button" onclick="imageEditor.applyCrop()">Apply Crop</button>
                        </div>
                    </div>
                `
            },
            transform: {
                title: 'Transform',
                content: `
                    <div class="control-group">
                        <label class="control-label">Rotation</label>
                        <div class="slider-control">
                            <input type="range" class="slider" id="rotationSlider" min="-180" max="180" value="0">
                            <input type="number" id="rotationValue" value="0" class="slider-value">
                        </div>
                    </div>
                    <div class="control-group">
                        <label class="control-label">Translation</label>
                        <div class="slider-control">
                            <span style="width: 20px; font-size: 12px;">X:</span>
                            <input type="number" id="translateX" value="0" class="slider-value" style="width: 60px;">
                            <span style="width: 20px; font-size: 12px; margin-left: 12px;">Y:</span>
                            <input type="number" id="translateY" value="0" class="slider-value" style="width: 60px;">
                        </div>
                        <div class="button-group">
                            <button class="button" onclick="imageEditor.applyTransform()">Apply Transform</button>
                        </div>
                    </div>
                `
            },
            color: {
                title: 'Color Adjustments',
                content: `
                    <div class="control-group">
                        <label class="control-label">Color Space</label>
                        <select id="colorSpace" style="width: 100%; padding: 8px; background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-sm); color: var(--text-primary); margin-bottom: 12px;">
                            <option value="RGB">RGB</option>
                            <option value="HSV">HSV</option>
                            <option value="LAB">LAB</option>
                            <option value="grayscale">Grayscale</option>
                        </select>
                        <div class="button-group">
                            <button class="button" onclick="imageEditor.applyColorSpace()">Apply</button>
                        </div>
                    </div>
                `
            },
            filter: {
                title: 'Filters & Effects',
                content: `
                    <div class="control-group">
                        <label class="control-label">Blur Amount</label>
                        <div class="slider-control">
                            <input type="range" class="slider" id="blurSlider" min="1" max="25" value="5">
                            <input type="number" id="blurValue" value="5" class="slider-value">
                        </div>
                    </div>
                    <div class="control-group">
                        <label class="control-label">Filter Type</label>
                        <select id="filterType" style="width: 100%; padding: 8px; background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-sm); color: var(--text-primary); margin-bottom: 12px;">
                            <option value="blur">Blur</option>
                            <option value="sharpen">Sharpen</option>
                            <option value="emboss">Emboss</option>
                        </select>
                        <div class="button-group">
                            <button class="button" onclick="imageEditor.applyFilter()">Apply Filter</button>
                        </div>
                    </div>
                `
            },
            edge: {
                title: 'Edge Detection',
                content: `
                    <div class="control-group">
                        <label class="control-label">Edge Detection Method</label>
                        <select id="edgeMethod" style="width: 100%; padding: 8px; background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-sm); color: var(--text-primary); margin-bottom: 12px;">
                            <option value="canny">Canny</option>
                            <option value="sobel">Sobel</option>
                        </select>
                        <div class="button-group">
                            <button class="button" onclick="imageEditor.applyEdgeDetection()">Apply</button>
                        </div>
                    </div>
                `
            },
            threshold: {
                title: 'Thresholding',
                content: `
                    <div class="control-group">
                        <label class="control-label">Threshold Value</label>
                        <div class="slider-control">
                            <input type="range" class="slider" id="thresholdSlider" min="0" max="255" value="127">
                            <input type="number" id="thresholdValue" value="127" class="slider-value">
                        </div>
                    </div>
                    <div class="control-group">
                        <label class="control-label">Threshold Type</label>
                        <select id="thresholdType" style="width: 100%; padding: 8px; background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-sm); color: var(--text-primary); margin-bottom: 12px;">
                            <option value="binary">Binary</option>
                            <option value="adaptive">Adaptive</option>
                        </select>
                        <div class="button-group">
                            <button class="button" onclick="imageEditor.applyThreshold()">Apply</button>
                        </div>
                    </div>
                `
            },
            morph: {
                title: 'Morphological Operations',
                content: `
                    <div class="control-group">
                        <label class="control-label">Operation Type</label>
                        <select id="morphType" style="width: 100%; padding: 8px; background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-sm); color: var(--text-primary); margin-bottom: 12px;">
                            <option value="dilate">Dilation</option>
                            <option value="erode">Erosion</option>
                        </select>
                        <div class="button-group">
                            <button class="button" onclick="imageEditor.applyMorphology()">Apply</button>
                        </div>
                    </div>
                `
            },
            draw: {
                title: 'Draw Shapes & Text',
                content: `
                    <div class="control-group">
                        <label class="control-label">Shape Type</label>
                        <select id="drawShape" style="width: 100%; padding: 8px; background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-sm); color: var(--text-primary); margin-bottom: 12px;">
                            <option value="rectangle">Rectangle</option>
                            <option value="circle">Circle</option>
                            <option value="text">Text</option>
                        </select>
                    </div>
                    <div class="control-group" id="textGroup" style="display: none;">
                        <label class="control-label">Text Content</label>
                        <input type="text" id="drawText" placeholder="Enter text to draw" style="width: 100%; padding: 8px; background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-sm); color: var(--text-primary); margin-bottom: 12px;">
                    </div>
                    <div class="button-group">
                        <button class="button" onclick="imageEditor.applyDraw()">Draw</button>
                    </div>
                `
            },
            arithmetic: {
                title: 'Arithmetic Operations',
                content: `
                    <div class="control-group">
                        <label class="control-label">Operation Type</label>
                        <select id="arithmeticType" style="width: 100%; padding: 8px; background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-sm); color: var(--text-primary); margin-bottom: 12px;">
                            <option value="add">Add</option>
                            <option value="subtract">Subtract</option>
                            <option value="bitwise_and">Bitwise AND</option>
                            <option value="bitwise_or">Bitwise OR</option>
                        </select>
                        <div class="button-group">
                            <button class="button" onclick="imageEditor.applyArithmetic()">Apply</button>
                        </div>
                    </div>
                `
            },
            histogram: {
                title: 'Histogram Operations',
                content: `
                    <div class="control-group">
                        <label class="control-label">Histogram Operation</label>
                        <select id="histogramType" style="width: 100%; padding: 8px; background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-sm); color: var(--text-primary); margin-bottom: 12px;">
                            <option value="equalize">Histogram Equalization</option>
                            <option value="clahe">CLAHE</option>
                        </select>
                        <div class="button-group">
                            <button class="button" onclick="imageEditor.applyHistogram()">Apply</button>
                        </div>
                    </div>
                `
            },
            denoise: {
                title: 'Noise Reduction',
                content: `
                    <div class="control-group">
                        <label class="control-label">Denoising Method</label>
                        <select id="denoiseType" style="width: 100%; padding: 8px; background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-sm); color: var(--text-primary); margin-bottom: 12px;">
                            <option value="bilateral">Bilateral Filter</option>
                            <option value="gaussian">Gaussian Blur</option>
                            <option value="median">Median Blur</option>
                        </select>
                        <div class="button-group">
                            <button class="button" onclick="imageEditor.applyDenoise()">Apply</button>
                        </div>
                    </div>
                `
            }
        };

        const config = toolConfigs[this.currentTool] || toolConfigs.select;
        this.propertiesHeader.textContent = config.title;
        this.propertiesContent.innerHTML = config.content;

        // Setup dynamic slider updates
        this.setupSliderUpdates();
    }

    setupSliderUpdates() {
        const sliders = this.propertiesContent.querySelectorAll('input[type="range"]');
        sliders.forEach(slider => {
            const valueInput = this.propertiesContent.querySelector(`#${slider.id.replace('Slider', 'Value')}`);
            if (valueInput) {
                slider.addEventListener('input', () => {
                    valueInput.value = slider.value;
                });
                valueInput.addEventListener('input', () => {
                    slider.value = valueInput.value;
                });
            }
        });

        // Handle draw shape selection
        const drawShape = this.propertiesContent.querySelector('#drawShape');
        const textGroup = this.propertiesContent.querySelector('#textGroup');
        if (drawShape && textGroup) {
            drawShape.addEventListener('change', () => {
                textGroup.style.display = drawShape.value === 'text' ? 'block' : 'none';
            });
        }
    }

    // Image processing methods
    async applyCrop() {
        if (!this.currentImage) return;
        
        const width = document.getElementById('cropWidth').value;
        const height = document.getElementById('cropHeight').value;
        
        await this.processImage('/resize_crop', {
            width: width,
            height: height,
            crop: 'true'
        }, 'Crop');
    }

    async applyTransform() {
        if (!this.currentImage) return;
        
        const angle = document.getElementById('rotationValue').value;
        const tx = document.getElementById('translateX').value;
        const ty = document.getElementById('translateY').value;
        
        await this.processImage('/transform', {
            angle: angle,
            tx: tx,
            ty: ty
        }, 'Transform');
    }

    async applyColorSpace() {
        if (!this.currentImage) return;
        
        const colorSpace = document.getElementById('colorSpace').value;
        
        if (colorSpace === 'grayscale') {
            await this.processImage('/grayscale', {}, 'Grayscale');
        } else {
            await this.processImage('/colorspace', {
                space: colorSpace
            }, `Color Space: ${colorSpace}`);
        }
    }

    async applyFilter() {
        if (!this.currentImage) return;
        
        const filterType = document.getElementById('filterType').value;
        
        await this.processImage('/convolution', {
            op: filterType
        }, `Filter: ${filterType}`);
    }

    async applyEdgeDetection() {
        if (!this.currentImage) return;
        
        const method = document.getElementById('edgeMethod').value;
        
        await this.processImage('/morph_edge', {
            op: method
        }, `Edge Detection: ${method}`);
    }

    async applyThreshold() {
        if (!this.currentImage) return;
        
        const type = document.getElementById('thresholdType').value;
        
        await this.processImage('/threshold', {
            op: type
        }, `Threshold: ${type}`);
    }

    async applyMorphology() {
        if (!this.currentImage) return;
        
        const type = document.getElementById('morphType').value;
        
        await this.processImage('/morph_edge', {
            op: type
        }, `Morphology: ${type}`);
    }

    async applyDraw() {
        if (!this.currentImage) return;
        
        const shape = document.getElementById('drawShape').value;
        const textInput = document.getElementById('drawText');
        const text = textInput ? textInput.value : '';
        
        const params = { shape: shape };
        if (shape === 'text' && text) {
            params.text = text;
        }
        
        await this.processImage('/draw', params, `Draw: ${shape}`);
    }

    async applyArithmetic() {
        if (!this.currentImage) return;
        
        const type = document.getElementById('arithmeticType').value;
        
        await this.processImage('/arithmetic', {
            op: type
        }, `Arithmetic: ${type}`);
    }

    async applyHistogram() {
        if (!this.currentImage) return;
        
        const type = document.getElementById('histogramType').value;
        
        await this.processImage('/histogram', {
            op: type
        }, `Histogram: ${type}`);
    }

    async applyDenoise() {
        if (!this.currentImage) return;
        
        const type = document.getElementById('denoiseType').value;
        
        await this.processImage('/denoise', {
            op: type
        }, `Denoise: ${type}`);
    }

    async processImage(endpoint, params, operationName) {
        this.showLoading(true);
        
        try {
            const formData = new FormData();
            // Always use the original image, not the current processed image
            formData.append('file', this.originalImage);
            
            // Add parameters
            Object.entries(params).forEach(([key, value]) => {
                formData.append(key, value);
            });
            
            const response = await fetch(this.backendUrl + endpoint, {
                method: 'POST',
                body: formData
            });
            
            if (!response.ok) {
                throw new Error(`Server error: ${response.status}`);
            }
            
            const blob = await response.blob();
            const imageUrl = URL.createObjectURL(blob);
            
            // Update current image
            this.currentImage = blob;
            this.canvasImage.src = imageUrl;
            
            // Add to history
            this.addToHistory(operationName, imageUrl);
            
            this.showNotification(`Applied ${operationName}`, 'success');
            
        } catch (error) {
            console.error('Error processing image:', error);
            this.showNotification(`Error applying ${operationName}`, 'error');
        } finally {
            this.showLoading(false);
        }
    }

    // History management
    addToHistory(operationName, imageUrl) {
        // Remove any history items after current index
        this.history = this.history.slice(0, this.historyIndex + 1);
        
        // Add new item
        this.history.push({
            name: operationName,
            imageUrl: imageUrl,
            timestamp: Date.now()
        });
        
        this.historyIndex = this.history.length - 1;
        this.updateHistoryUI();
        this.updateUI();
    }

    updateHistoryUI() {
        this.historyList.innerHTML = '';
        
        this.history.forEach((item, index) => {
            const historyItem = document.createElement('div');
            historyItem.className = `history-item ${index === this.historyIndex ? 'active' : ''}`;
            historyItem.innerHTML = `
                <i class="fas fa-image history-icon"></i>
                <span>${item.name}</span>
            `;
            historyItem.addEventListener('click', () => this.goToHistoryItem(index));
            this.historyList.appendChild(historyItem);
        });
    }

    goToHistoryItem(index) {
        if (index >= 0 && index < this.history.length) {
            this.historyIndex = index;
            const item = this.history[index];
            this.canvasImage.src = item.imageUrl;
            
            // Convert the displayed image back to blob for currentImage
            // This is for display purposes, but operations still use originalImage
            fetch(item.imageUrl)
                .then(response => response.blob())
                .then(blob => {
                    this.currentImage = blob;
                })
                .catch(error => console.error('Error converting history item:', error));
            
            this.updateHistoryUI();
            this.updateUI();
        }
    }

    undo() {
        if (this.historyIndex > 0) {
            this.goToHistoryItem(this.historyIndex - 1);
        }
    }

    redo() {
        if (this.historyIndex < this.history.length - 1) {
            this.goToHistoryItem(this.historyIndex + 1);
        }
    }

    clearHistory() {
        this.history = [];
        this.historyIndex = -1;
        this.updateHistoryUI();
        this.updateUI();
    }

    // Zoom controls
    zoom(factor) {
        this.zoomLevel *= factor;
        this.zoomLevel = Math.max(0.1, Math.min(5.0, this.zoomLevel));
        this.updateZoom();
    }

    zoomToFit() {
        if (!this.canvasImage.src) return;
        
        const containerRect = this.canvasViewport.getBoundingClientRect();
        const imageRect = this.canvasImage.getBoundingClientRect();
        
        const scaleX = containerRect.width / this.canvasImage.naturalWidth;
        const scaleY = containerRect.height / this.canvasImage.naturalHeight;
        
        this.zoomLevel = Math.min(scaleX, scaleY, 1.0);
        this.updateZoom();
    }

    updateZoom() {
        this.canvasImage.style.transform = `scale(${this.zoomLevel})`;
        if (this.zoomDisplay) {
            this.zoomDisplay.textContent = `${Math.round(this.zoomLevel * 100)}%`;
        }
    }

    // UI updates
    updateUI() {
        const hasImage = !!this.canvasImage.src;
        const canUndo = this.historyIndex > 0;
        const canRedo = this.historyIndex < this.history.length - 1;
        
        // Update undo/redo buttons
        const undoBtn = document.getElementById('undoBtn');
        const redoBtn = document.getElementById('redoBtn');
        
        if (undoBtn) undoBtn.disabled = !canUndo;
        if (redoBtn) redoBtn.disabled = !canRedo;
        
        // Update tool availability
        this.toolButtons.forEach(btn => {
            btn.disabled = !hasImage && btn.dataset.tool !== 'select';
        });
    }

    // Utility methods
    showLoading(show) {
        this.loadingOverlay.classList.toggle('active', show);
    }

    showNotification(message, type = 'info') {
        // Create notification element
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 50px;
            right: 20px;
            padding: 12px 20px;
            background: ${type === 'error' ? 'var(--error)' : type === 'success' ? 'var(--success)' : 'var(--accent)'};
            color: white;
            border-radius: var(--radius);
            box-shadow: 0 4px 12px var(--shadow);
            z-index: 2000;
            font-weight: 500;
            opacity: 0;
            transition: var(--transition);
        `;
        notification.textContent = message;
        document.body.appendChild(notification);
        
        // Animate in
        setTimeout(() => notification.style.opacity = '1', 10);
        
        // Remove after delay
        setTimeout(() => {
            notification.style.opacity = '0';
            setTimeout(() => document.body.removeChild(notification), 200);
        }, 3000);
    }

    showFileMenu() {
        // Implement file menu functionality
        this.showContextMenu([
            { label: 'Open...', action: () => this.fileInput.click() },
            { label: 'Save As PNG...', action: () => this.saveImage('png') },
            { label: 'Save As JPG...', action: () => this.saveImage('jpg') },
            { label: 'Export to PDF...', action: () => this.exportPDF() }
        ]);
    }

    showEditMenu() {
        // Implement edit menu functionality
        this.showContextMenu([
            { label: 'Undo', action: () => this.undo(), enabled: this.historyIndex > 0 },
            { label: 'Redo', action: () => this.redo(), enabled: this.historyIndex < this.history.length - 1 },
            { label: 'Clear History', action: () => this.clearHistory() }
        ]);
    }

    showContextMenu(items) {
        // Simple context menu implementation
        console.log('Context menu:', items);
    }

    async saveImage(format) {
        if (!this.canvasImage.src) return;
        
        const a = document.createElement('a');
        a.href = this.canvasImage.src;
        a.download = `processed_image.${format}`;
        a.click();
        
        this.showNotification(`Image saved as ${format.toUpperCase()}`, 'success');
    }

    async exportPDF() {
        if (!this.currentImage) return;
        
        this.showLoading(true);
        
        try {
            const formData = new FormData();
            formData.append('file', this.currentImage);
            
            const response = await fetch(`${this.backendUrl}/export_pdf`, {
                method: 'POST',
                body: formData
            });
            
            if (!response.ok) throw new Error('Export failed');
            
            const blob = await response.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'image_report.pdf';
            a.click();
            
            this.showNotification('PDF exported successfully', 'success');
            
        } catch (error) {
            console.error('Error exporting PDF:', error);
            this.showNotification('Error exporting PDF', 'error');
        } finally {
            this.showLoading(false);
        }
    }

    handleKeyboard(e) {
        // Keyboard shortcuts
        if (e.ctrlKey || e.metaKey) {
            switch (e.key) {
                case 'z':
                    e.preventDefault();
                    if (e.shiftKey) {
                        this.redo();
                    } else {
                        this.undo();
                    }
                    break;
                case 'o':
                    e.preventDefault();
                    this.fileInput.click();
                    break;
                case '+':
                case '=':
                    e.preventDefault();
                    this.zoom(1.2);
                    break;
                case '-':
                    e.preventDefault();
                    this.zoom(0.8);
                    break;
                case '0':
                    e.preventDefault();
                    this.zoomToFit();
                    break;
            }
        }
    }

    // ===== NEW STRETCH FEATURES =====

    // Batch Processing Methods
    showBatchModal() {
        document.getElementById('batchModal').style.display = 'flex';
        this.batchFiles = [];
        this.updateBatchPreview();
    }

    hideBatchModal() {
        document.getElementById('batchModal').style.display = 'none';
        this.batchFiles = [];
        this.updateBatchPreview();
    }

    handleBatchDragOver(e) {
        e.preventDefault();
        document.getElementById('batchDropZone').classList.add('drag-over');
    }

    handleBatchDragLeave(e) {
        e.preventDefault();
        document.getElementById('batchDropZone').classList.remove('drag-over');
    }

    handleBatchDrop(e) {
        e.preventDefault();
        document.getElementById('batchDropZone').classList.remove('drag-over');
        
        const files = Array.from(e.dataTransfer.files).filter(file => file.type.startsWith('image/'));
        this.addBatchFiles(files);
    }

    handleBatchFileSelect(e) {
        const files = Array.from(e.target.files).filter(file => file.type.startsWith('image/'));
        this.addBatchFiles(files);
    }

    addBatchFiles(files) {
        if (this.batchFiles.length + files.length > 10) {
            this.showNotification('Maximum 10 images allowed for batch processing', 'warning');
            files = files.slice(0, 10 - this.batchFiles.length);
        }

        this.batchFiles.push(...files);
        this.updateBatchPreview();
    }

    updateBatchPreview() {
        const previewDiv = document.getElementById('batchPreview');
        const imageGrid = document.getElementById('imageGrid');
        const processBtn = document.getElementById('processBatch');

        if (this.batchFiles.length === 0) {
            previewDiv.style.display = 'none';
            processBtn.disabled = true;
            return;
        }

        previewDiv.style.display = 'block';
        processBtn.disabled = false;

        imageGrid.innerHTML = '';
        this.batchFiles.forEach((file, index) => {
            const item = document.createElement('div');
            item.className = 'image-grid-item';

            const img = document.createElement('img');
            img.src = URL.createObjectURL(file);
            img.alt = file.name;

            const removeBtn = document.createElement('button');
            removeBtn.className = 'remove-btn';
            removeBtn.innerHTML = '×';
            removeBtn.onclick = () => this.removeBatchFile(index);

            item.appendChild(img);
            item.appendChild(removeBtn);
            imageGrid.appendChild(item);
        });
    }

    removeBatchFile(index) {
        this.batchFiles.splice(index, 1);
        this.updateBatchPreview();
    }

    async processBatch() {
        if (this.batchFiles.length === 0) return;

        this.showLoading(true);

        try {
            const formData = new FormData();
            this.batchFiles.forEach(file => {
                formData.append('files', file);
            });

            const operation = document.getElementById('batchOperation').value;
            formData.append('operation', operation);
            formData.append('params', '{}');

            const response = await fetch(`${this.backendUrl}/batch_process`, {
                method: 'POST',
                body: formData
            });

            if (!response.ok) throw new Error('Batch processing failed');

            const result = await response.json();
            this.batchResults = result;
            this.showBatchResults(result);
            this.hideBatchModal();

        } catch (error) {
            console.error('Error processing batch:', error);
            this.showNotification('Error processing batch', 'error');
        } finally {
            this.showLoading(false);
        }
    }

    showBatchResults(results) {
        const modal = document.getElementById('batchResultsModal');
        const summary = document.getElementById('resultsSummary');
        const grid = document.getElementById('resultsGrid');

        summary.innerHTML = `
            <h4>Batch Processing Complete</h4>
            <p>Successfully processed ${results.processed_count} images with ${document.getElementById('batchOperation').value} operation.</p>
        `;

        grid.innerHTML = '';
        results.results.forEach(result => {
            const item = document.createElement('div');
            item.className = 'result-item';

            const img = document.createElement('img');
            img.src = `data:image/png;base64,${result.image_data}`;
            img.alt = result.filename;

            const filename = document.createElement('div');
            filename.className = 'filename';
            filename.textContent = result.filename;

            item.appendChild(img);
            item.appendChild(filename);
            grid.appendChild(item);
        });

        modal.style.display = 'flex';
    }

    hideBatchResultsModal() {
        document.getElementById('batchResultsModal').style.display = 'none';
    }

    async downloadBatchResults() {
        if (!this.batchResults) return;

        // Create zip file with all processed images
        const zip = new JSZip();
        
        for (const result of this.batchResults.results) {
            const imageData = atob(result.image_data);
            const bytes = new Uint8Array(imageData.length);
            for (let i = 0; i < imageData.length; i++) {
                bytes[i] = imageData.charCodeAt(i);
            }
            zip.file(result.filename, bytes);
        }

        const content = await zip.generateAsync({type: "blob"});
        const url = URL.createObjectURL(content);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'batch_processed_images.zip';
        a.click();

        this.showNotification('Batch results downloaded', 'success');
    }

    // Comparison Methods
    async showComparison() {
        if (!this.currentImage) {
            this.showNotification('Please load an image first', 'warning');
            return;
        }

        if (!this.currentTool || this.currentTool === 'select') {
            this.showNotification('Please select a processing tool first', 'warning');
            return;
        }

        this.showLoading(true);

        try {
            let endpoint, params;
            
            // Map tools to their correct endpoints and parameters
            switch(this.currentTool) {
                case 'filter':
                    endpoint = '/convolution';
                    params = { op: document.getElementById('filterType').value };
                    break;
                case 'edge':
                    endpoint = '/morph_edge';
                    params = { op: document.getElementById('edgeMethod').value };
                    break;
                case 'threshold':
                    endpoint = '/threshold';
                    params = { op: document.getElementById('thresholdType').value };
                    break;
                case 'histogram':
                    endpoint = '/histogram';
                    params = { op: 'equalize' };
                    break;
                case 'denoise':
                    endpoint = '/denoise';
                    params = { method: document.getElementById('denoiseMethod').value };
                    break;
                case 'color':
                    endpoint = '/grayscale';
                    params = {};
                    break;
                case 'morph':
                    endpoint = '/morph_edge';
                    params = { op: document.getElementById('morphType').value };
                    break;
                default:
                    throw new Error('Unsupported tool for comparison');
            }

            // Get processed image
            const formData = new FormData();
            formData.append('file', this.currentImage);
            
            // Add parameters
            Object.keys(params).forEach(key => {
                formData.append(key, params[key]);
            });

            const response = await fetch(`${this.backendUrl}${endpoint}`, {
                method: 'POST',
                body: formData
            });

            if (!response.ok) throw new Error('Processing failed');

            const processedBlob = await response.blob();
            const processedUrl = URL.createObjectURL(processedBlob);
            const originalUrl = this.canvasImage.src;
            
            // Set up comparison view
            const originalCompImg = document.getElementById('originalComparisonImage');
            const processedCompImg = document.getElementById('processedComparisonImage');
            const processedLabel = document.getElementById('processedLabel');
            
            originalCompImg.src = originalUrl;
            processedCompImg.src = processedUrl;
            
            // Update label based on current tool
            const operationLabels = {
                'filter': 'Filtered',
                'edge': 'Edge Detection',
                'threshold': 'Threshold',
                'histogram': 'Histogram Equalized',
                'denoise': 'Denoised',
                'color': 'Grayscale',
                'morph': 'Morphology'
            };
            
            processedLabel.textContent = `${operationLabels[this.currentTool] || this.currentTool.charAt(0).toUpperCase() + this.currentTool.slice(1)} Image`;
            
            // Enter comparison mode
            this.canvasContent.classList.add('comparison-mode');
            document.getElementById('compareBtn').style.display = 'none';
            document.getElementById('exitCompareBtn').style.display = 'inline-flex';
            
            this.showNotification('Showing side-by-side comparison', 'success');

        } catch (error) {
            console.error('Error creating comparison:', error);
            this.showNotification('Error creating comparison', 'error');
        } finally {
            this.showLoading(false);
        }
    }
    
    exitComparison() {
        // Exit comparison mode
        this.canvasContent.classList.remove('comparison-mode');
        document.getElementById('compareBtn').style.display = 'inline-flex';
        document.getElementById('exitCompareBtn').style.display = 'none';
        
        this.showNotification('Exited comparison mode', 'success');
    }
    
    getToolParameters() {
        // Get current tool parameters from the properties panel
        const params = {};
        
        // Get slider values if they exist
        const sliders = this.propertiesContent.querySelectorAll('.slider');
        sliders.forEach(slider => {
            if (slider.id) {
                params[slider.id] = parseFloat(slider.value);
            }
        });
        
        return params;
    }

    // Export Methods
    showExportModal() {
        if (!this.currentImage) {
            this.showNotification('Please load an image first', 'warning');
            return;
        }
        document.getElementById('exportModal').style.display = 'flex';
        this.updateExportOptions();
    }

    hideExportModal() {
        document.getElementById('exportModal').style.display = 'none';
    }

    updateExportOptions() {
        const format = document.getElementById('exportFormat').value;
        const qualitySection = document.getElementById('qualitySection');
        
        if (format === 'jpg' || format === 'jpeg') {
            qualitySection.style.display = 'block';
        } else {
            qualitySection.style.display = 'none';
        }
    }

    async exportImage() {
        if (!this.currentImage) return;

        const format = document.getElementById('exportFormat').value;
        const quality = document.getElementById('exportQuality').value;

        this.showLoading(true);

        try {
            const formData = new FormData();
            formData.append('file', this.currentImage);
            formData.append('format', format);
            formData.append('quality', quality);

            const response = await fetch(`${this.backendUrl}/export`, {
                method: 'POST',
                body: formData
            });

            if (!response.ok) throw new Error('Export failed');

            const blob = await response.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            
            const extension = format === 'pdf' ? 'pdf' : format === 'jpg' ? 'jpg' : 'png';
            a.download = `exported_image.${extension}`;
            a.click();

            this.hideExportModal();
            this.showNotification(`Image exported as ${format.toUpperCase()}`, 'success');

        } catch (error) {
            console.error('Error exporting image:', error);
            this.showNotification('Error exporting image', 'error');
        } finally {
            this.showLoading(false);
        }
    }
}

// Initialize the application
const imageEditor = new ImageEditor();

// Export for global access
window.imageEditor = imageEditor;
