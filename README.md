# PixelLab Pro - Professional Image Editor

Members:
LAURENCE JAY PEREZ
JUSALYN GIMAO
MIA LOLOR

A modern, Photoshop-style desktop application for professional image editing and processing, powered by OpenCV and built with Electron.js.

#Features

### Professional Interface
- **Dark theme** with sleek, modern design
- **Tool sidebar** with organized editing tools
- **Properties panel** with real-time controls
- **History panel** for tracking all edits
- **Canvas area** with zoom controls and smooth interactions
- **Menu bar** with File, Edit, Image, Filter, and View options

### Advanced Image Processing
- **Color adjustments**: RGB, HSV, LAB color spaces, grayscale conversion
- **Filters & effects**: Blur, sharpen, emboss with adjustable parameters
- **Edge detection**: Canny, Sobel, Laplacian algorithms
- **Thresholding**: Binary, adaptive, and Otsu methods
- **Morphological operations**: Dilation, erosion, opening, closing
- **Transformations**: Rotation, translation with precise controls
- **Crop & resize**: Professional cropping and scaling tools

### Professional Workflow
- **Undo/Redo** functionality with full history tracking
- **Real-time preview** of all adjustments
- **Keyboard shortcuts** for efficient workflow
- **Drag & drop** image loading
- **Multiple export formats** (PNG, JPG, PDF)
- **Zoom controls** with fit-to-screen option

## Project Structure
```
project-root/
├── frontend/   (Electron.js app UI)
├── backend/    (FastAPI + OpenCV)
└── README.md   (setup + usage instructions)
```

## Setup Instructions

### 1. Backend (FastAPI + OpenCV)

#### Install dependencies
```
cd backend/app
pip install -r requirements.txt
```

#### Run FastAPI server
```
uvicorn main:app --reload
```

Server runs at `http://localhost:8000`

### 2. Frontend (PixelLab Pro)

#### Install dependencies
```bash
cd frontend
npm install
```

#### Start the application
```bash
npm start
```

For development mode:
```bash
npm run dev
```

### 3. Usage

1. **Start the backend server** first (FastAPI with OpenCV)
2. **Launch PixelLab Pro** (Electron application)
3. **Load an image** by dragging & dropping or using File menu
4. **Select tools** from the left sidebar to edit your image
5. **Adjust parameters** in the properties panel on the right
6. **Apply effects** and see real-time results
7. **Use undo/redo** to manage your editing history
8. **Export your work** in various formats

## 🎨 Interface Overview

- **Top Menu Bar**: File operations, edit functions, and application settings
- **Tools Panel**: Quick access to all editing tools with tooltips
- **Canvas Area**: Main editing workspace with zoom controls
- **Properties Panel**: Tool-specific controls and parameters
- **History Panel**: Complete edit history with one-click navigation

## ⌨️ Keyboard Shortcuts

- `Ctrl+O` - Open image
- `Ctrl+Z` - Undo
- `Ctrl+Shift+Z` - Redo
- `Ctrl++` - Zoom in
- `Ctrl+-` - Zoom out
- `Ctrl+0` - Fit to screen

## 🚀 Technical Details

- **Frontend**: Electron.js with modern HTML5/CSS3/JavaScript
- **Backend**: FastAPI with OpenCV for image processing
- **Architecture**: Client-server model with REST API communication
- **Performance**: Optimized for real-time image processing and smooth UI interactions

---

Experience professional image editing with the power of OpenCV! 🎉

