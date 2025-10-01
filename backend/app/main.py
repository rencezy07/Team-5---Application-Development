from fastapi import FastAPI, File, UploadFile, Form, HTTPException
from fastapi.responses import StreamingResponse, JSONResponse, FileResponse
from fastapi.middleware.cors import CORSMiddleware
import cv2
import numpy as np
from io import BytesIO
from PIL import Image
import tempfile
import os
import zipfile
from typing import List, Optional
import base64
import json
from datetime import datetime

# PDF generation will use PIL for now instead of reportlab
try:
    from reportlab.lib.pagesizes import letter, A4
    from reportlab.pdfgen import canvas
    from reportlab.lib.utils import ImageReader
    REPORTLAB_AVAILABLE = True
except ImportError:
    REPORTLAB_AVAILABLE = False
    print("Warning: reportlab not available, PDF export will use basic functionality")

app = FastAPI()

# Allow CORS for frontend
app.add_middleware(
	CORSMiddleware,
	allow_origins=["*"],
	allow_credentials=True,
	allow_methods=["*"],
	allow_headers=["*"],
)
# Helper: Convert OpenCV image to bytes
def cv2_to_bytes(img, ext=".png"):
	success, encoded_image = cv2.imencode(ext, img)
	return BytesIO(encoded_image.tobytes())

# Helper: Read image from UploadFile
def read_image(file: UploadFile):
	image = Image.open(BytesIO(file.file.read()))
	return cv2.cvtColor(np.array(image), cv2.COLOR_RGB2BGR)

# 1. Load, display, save image + show dimensions
@app.post("/upload")
async def upload_image(file: UploadFile = File(...)):
	img = read_image(file)
	h, w = img.shape[:2]
	buf = cv2_to_bytes(img)
	return StreamingResponse(buf, media_type="image/png", headers={"X-Image-Width": str(w), "X-Image-Height": str(h)})

# 2. Convert to grayscale
@app.post("/grayscale")
async def grayscale(file: UploadFile = File(...)):
	img = read_image(file)
	gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
	buf = cv2_to_bytes(gray)
	return StreamingResponse(buf, media_type="image/png")

# 3. Convert between color spaces
@app.post("/colorspace")
async def colorspace(file: UploadFile = File(...), space: str = Form(...)):
	img = read_image(file)
	spaces = {"RGB": cv2.COLOR_BGR2RGB, "HSV": cv2.COLOR_BGR2HSV, "LAB": cv2.COLOR_BGR2LAB}
	if space not in spaces:
		return JSONResponse({"error": "Invalid color space"}, status_code=400)
	converted = cv2.cvtColor(img, spaces[space])
	buf = cv2_to_bytes(converted)
	return StreamingResponse(buf, media_type="image/png")

# 4. Draw shapes and text
@app.post("/draw")
async def draw(file: UploadFile = File(...), shape: str = Form(...), text: str = Form(None)):
	img = read_image(file)
	if shape == "rectangle":
		cv2.rectangle(img, (50, 50), (200, 200), (0,255,0), 3)
	elif shape == "circle":
		cv2.circle(img, (150,150), 75, (255,0,0), 3)
	elif shape == "text" and text:
		cv2.putText(img, text, (50,50), cv2.FONT_HERSHEY_SIMPLEX, 1, (0,0,255), 2)
	buf = cv2_to_bytes(img)
	return StreamingResponse(buf, media_type="image/png")

# 5. Transformations (translation + rotation)
@app.post("/transform")
async def transform(file: UploadFile = File(...), tx: int = Form(0), ty: int = Form(0), angle: float = Form(0)):
	img = read_image(file)
	rows, cols = img.shape[:2]
	M = np.float32([[1, 0, tx], [0, 1, ty]])
	img = cv2.warpAffine(img, M, (cols, rows))
	if angle != 0:
		M_rot = cv2.getRotationMatrix2D((cols/2, rows/2), angle, 1)
		img = cv2.warpAffine(img, M_rot, (cols, rows))
	buf = cv2_to_bytes(img)
	return StreamingResponse(buf, media_type="image/png")

# 6. Scaling, resizing, interpolation + cropping
@app.post("/resize_crop")
async def resize_crop(file: UploadFile = File(...), width: int = Form(100), height: int = Form(100), crop: bool = Form(False)):
	img = read_image(file)
	resized = cv2.resize(img, (width, height), interpolation=cv2.INTER_LINEAR)
	if crop:
		cropped = resized[10:height-10, 10:width-10]
	else:
		cropped = resized
	buf = cv2_to_bytes(cropped)
	return StreamingResponse(buf, media_type="image/png")

# 7. Arithmetic + bitwise operations
@app.post("/arithmetic")
async def arithmetic(file: UploadFile = File(...), op: str = Form("add")):
	img = read_image(file)
	dummy = np.ones(img.shape, dtype=img.dtype) * 50
	if op == "add":
		out = cv2.add(img, dummy)
	elif op == "subtract":
		out = cv2.subtract(img, dummy)
	elif op == "bitwise_and":
		out = cv2.bitwise_and(img, dummy)
	elif op == "bitwise_or":
		out = cv2.bitwise_or(img, dummy)
	else:
		out = img
	buf = cv2_to_bytes(out)
	return StreamingResponse(buf, media_type="image/png")

# 8. Convolutions, blurring, sharpening
@app.post("/convolution")
async def convolution(file: UploadFile = File(...), op: str = Form("blur")):
	img = read_image(file)
	if op == "blur":
		out = cv2.GaussianBlur(img, (7,7), 0)
	elif op == "sharpen":
		kernel = np.array([[0,-1,0],[-1,5,-1],[0,-1,0]])
		out = cv2.filter2D(img, -1, kernel)
	else:
		out = img
	buf = cv2_to_bytes(out)
	return StreamingResponse(buf, media_type="image/png")

# 9. Thresholding
@app.post("/threshold")
async def threshold(file: UploadFile = File(...), op: str = Form("binary")):
	img = read_image(file)
	gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
	if op == "binary":
		_, out = cv2.threshold(gray, 127, 255, cv2.THRESH_BINARY)
	elif op == "adaptive":
		out = cv2.adaptiveThreshold(gray, 255, cv2.ADAPTIVE_THRESH_MEAN_C, cv2.THRESH_BINARY, 11, 2)
	else:
		out = gray
	buf = cv2_to_bytes(out)
	return StreamingResponse(buf, media_type="image/png")

# 10. Dilation, erosion, edge detection
@app.post("/morph_edge")
async def morph_edge(file: UploadFile = File(...), op: str = Form("canny")):
	img = read_image(file)
	gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
	kernel = np.ones((5,5), np.uint8)
	if op == "dilate":
		out = cv2.dilate(gray, kernel, iterations=1)
	elif op == "erode":
		out = cv2.erode(gray, kernel, iterations=1)
	elif op == "canny":
		out = cv2.Canny(gray, 100, 200)
	elif op == "sobel":
		out = cv2.Sobel(gray, cv2.CV_64F, 1, 0, ksize=5)
		out = cv2.convertScaleAbs(out)
	else:
		out = gray
	buf = cv2_to_bytes(out)
	return StreamingResponse(buf, media_type="image/png")

# 11. Histogram operations
@app.post("/histogram")
async def histogram_operations(file: UploadFile = File(...), op: str = Form("equalize")):
	img = read_image(file)
	gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
	if op == "equalize":
		out = cv2.equalizeHist(gray)
	elif op == "clahe":
		clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8,8))
		out = clahe.apply(gray)
	else:
		out = gray
	buf = cv2_to_bytes(out)
	return StreamingResponse(buf, media_type="image/png")

# 12. Noise reduction
@app.post("/denoise")
async def denoise(file: UploadFile = File(...), op: str = Form("bilateral")):
	img = read_image(file)
	if op == "bilateral":
		out = cv2.bilateralFilter(img, 9, 75, 75)
	elif op == "gaussian":
		out = cv2.GaussianBlur(img, (5, 5), 0)
	elif op == "median":
		out = cv2.medianBlur(img, 5)
	else:
		out = img
	buf = cv2_to_bytes(out)
	return StreamingResponse(buf, media_type="image/png")

# Helper: Process single image with given operation
async def process_single_image(img: np.ndarray, operation: str, params: dict = None) -> np.ndarray:
	"""Process a single image with the specified operation"""
	if params is None:
		params = {}
	
	if operation == "grayscale":
		return cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
	elif operation == "blur":
		return cv2.GaussianBlur(img, (7,7), 0)
	elif operation == "sharpen":
		kernel = np.array([[0,-1,0],[-1,5,-1],[0,-1,0]])
		return cv2.filter2D(img, -1, kernel)
	elif operation == "canny":
		gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
		return cv2.Canny(gray, 100, 200)
	elif operation == "threshold":
		gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
		_, out = cv2.threshold(gray, 127, 255, cv2.THRESH_BINARY)
		return out
	elif operation == "histogram_equalize":
		gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
		return cv2.equalizeHist(gray)
	elif operation == "denoise":
		return cv2.bilateralFilter(img, 9, 75, 75)
	elif operation == "resize":
		width = params.get("width", 100)
		height = params.get("height", 100)
		return cv2.resize(img, (width, height), interpolation=cv2.INTER_LINEAR)
	else:
		return img

# 13. Batch processing of multiple images
@app.post("/batch_process")
async def batch_process(files: List[UploadFile] = File(...), operation: str = Form(...), params: str = Form("{}")):
	"""Process multiple images with the same operation"""
	if len(files) > 10:  # Limit to prevent server overload
		raise HTTPException(status_code=400, detail="Maximum 10 images allowed per batch")
	
	try:
		operation_params = json.loads(params) if params else {}
	except json.JSONDecodeError:
		operation_params = {}
	
	results = []
	
	# Create temporary directory for batch results
	temp_dir = tempfile.mkdtemp()
	
	try:
		for i, file in enumerate(files):
			# Read and process image
			img = read_image(file)
			processed_img = await process_single_image(img, operation, operation_params)
			
			# Save processed image
			filename = f"processed_{i+1}_{file.filename}" if file.filename else f"processed_{i+1}.png"
			filepath = os.path.join(temp_dir, filename)
			
			# Handle grayscale images
			if len(processed_img.shape) == 2:
				cv2.imwrite(filepath, processed_img)
			else:
				cv2.imwrite(filepath, processed_img)
			
			# Convert to base64 for response
			_, buffer = cv2.imencode('.png', processed_img)
			img_base64 = base64.b64encode(buffer).decode('utf-8')
			
			results.append({
				"filename": filename,
				"image_data": img_base64,
				"original_filename": file.filename
			})
		
		# Create zip file with all processed images
		zip_path = os.path.join(temp_dir, "batch_processed.zip")
		with zipfile.ZipFile(zip_path, 'w') as zipf:
			for filename in os.listdir(temp_dir):
				if filename.endswith(('.png', '.jpg', '.jpeg')):
					zipf.write(os.path.join(temp_dir, filename), filename)
		
		return JSONResponse({
			"success": True,
			"processed_count": len(results),
			"results": results,
			"download_available": True
		})
		
	except Exception as e:
		raise HTTPException(status_code=500, detail=f"Batch processing failed: {str(e)}")

# 14. Download batch processed images as zip
@app.get("/download_batch/{batch_id}")
async def download_batch(batch_id: str):
	"""Download batch processed images as zip file"""
	# In a production app, you'd store batch results with proper IDs
	# For now, we'll use a simple approach
	temp_dir = tempfile.gettempdir()
	zip_path = os.path.join(temp_dir, f"batch_processed_{batch_id}.zip")
	
	if os.path.exists(zip_path):
		return FileResponse(
			zip_path,
			media_type="application/zip",
			filename=f"batch_processed_{batch_id}.zip"
		)
	else:
		raise HTTPException(status_code=404, detail="Batch file not found")

# 15. Side-by-side comparison
@app.post("/compare")
async def compare_images(file: UploadFile = File(...), operation: str = Form(...), params: str = Form("{}")):
	"""Create side-by-side comparison of original vs processed image"""
	try:
		operation_params = json.loads(params) if params else {}
	except json.JSONDecodeError:
		operation_params = {}
	
	original_img = read_image(file)
	processed_img = await process_single_image(original_img, operation, operation_params)
	
	# Ensure both images have the same dimensions
	h, w = original_img.shape[:2]
	
	# Handle grayscale processed images
	if len(processed_img.shape) == 2:
		processed_img = cv2.cvtColor(processed_img, cv2.COLOR_GRAY2BGR)
	
	# Resize processed image to match original
	processed_img = cv2.resize(processed_img, (w, h))
	
	# Create side-by-side comparison
	comparison = np.hstack((original_img, processed_img))
	
	# Add labels
	label_height = 30
	labeled_comparison = np.zeros((comparison.shape[0] + label_height, comparison.shape[1], 3), dtype=np.uint8)
	labeled_comparison[label_height:, :] = comparison
	
	# Add text labels
	cv2.putText(labeled_comparison, "Original", (w//4, 20), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 255), 2)
	cv2.putText(labeled_comparison, f"Processed ({operation})", (w + w//4, 20), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 255), 2)
	
	buf = cv2_to_bytes(labeled_comparison)
	return StreamingResponse(buf, media_type="image/png")

# 16. Export in multiple formats
@app.post("/export")
async def export_image(file: UploadFile = File(...), format: str = Form("png"), quality: int = Form(95)):
	"""Export image in specified format (png, jpg, pdf)"""
	img = read_image(file)
	
	if format.lower() == "pdf":
		# Create simple PDF using PIL (fallback approach)
		temp_dir = tempfile.mkdtemp()
		pdf_path = os.path.join(temp_dir, "exported_image.pdf")
		
		try:
			# Convert OpenCV image to PIL
			img_rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
			pil_img = Image.fromarray(img_rgb)
			
			# Save as PDF using PIL (basic functionality)
			pil_img.save(pdf_path, "PDF", resolution=100.0)
			
			return FileResponse(
				pdf_path,
				media_type="application/pdf",
				filename="exported_image.pdf"
			)
			
		except Exception as e:
			raise HTTPException(status_code=500, detail=f"PDF export failed: {str(e)}")
	
	else:
		# Export as image format
		if format.lower() == "jpg" or format.lower() == "jpeg":
			# Convert to RGB for JPEG (no alpha channel)
			if len(img.shape) == 3:
				img_rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
			else:
				img_rgb = img
			
			pil_img = Image.fromarray(img_rgb)
			buffer = BytesIO()
			pil_img.save(buffer, format="JPEG", quality=quality)
			buffer.seek(0)
			
			return StreamingResponse(
				buffer,
				media_type="image/jpeg",
				headers={"Content-Disposition": "attachment; filename=exported_image.jpg"}
			)
		
		else:  # PNG or other formats
			success, encoded_image = cv2.imencode(f".{format}", img)
			if not success:
				raise HTTPException(status_code=400, detail=f"Unsupported format: {format}")
			
			buffer = BytesIO(encoded_image.tobytes())
			return StreamingResponse(
				buffer,
				media_type=f"image/{format}",
				headers={"Content-Disposition": f"attachment; filename=exported_image.{format}"}
			)

# 17. Create processing report (simplified JSON report for now)
@app.post("/create_report")
async def create_report(file: UploadFile = File(...), operations: str = Form(...)):
	"""Create a report with original image, processed images, and operation details"""
	try:
		ops_list = json.loads(operations)
	except json.JSONDecodeError:
		raise HTTPException(status_code=400, detail="Invalid operations format")
	
	original_img = read_image(file)
	
	# Create a simple JSON report for now
	report = {
		"timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
		"original_filename": file.filename or "Uploaded Image",
		"original_dimensions": f"{original_img.shape[1]} x {original_img.shape[0]}",
		"operations_applied": len(ops_list),
		"operations": ops_list
	}
	
	return JSONResponse(report)

if __name__ == "__main__":
	import uvicorn
	uvicorn.run(app, host="0.0.0.0", port=8000)
