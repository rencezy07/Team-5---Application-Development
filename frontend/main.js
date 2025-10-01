const { app, BrowserWindow } = require('electron');

function createWindow() {
	const path = require('path');
	const win = new BrowserWindow({
		width: 1400,
		height: 900,
		minWidth: 1000,
		minHeight: 700,
		icon: path.join(__dirname, 'icon.ico'),
		titleBarStyle: 'default',
		backgroundColor: '#1a1a1a',
		webPreferences: {
			nodeIntegration: true,
			contextIsolation: false,
			enableRemoteModule: true
		},
		show: false // Don't show until ready
	});
	
	// Load the app
	win.loadFile('index.html');
	
	// Show window when ready to prevent visual flash
	win.once('ready-to-show', () => {
		win.show();
		
		// Focus the window
		if (process.platform === 'darwin') {
			app.dock.show();
		}
	});
	
	// Open DevTools in development
	if (process.env.NODE_ENV === 'development') {
		win.webContents.openDevTools();
	}
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
	if (process.platform !== 'darwin') {
		app.quit();
	}
});

app.on('activate', () => {
	if (BrowserWindow.getAllWindows().length === 0) {
		createWindow();
	}
});
