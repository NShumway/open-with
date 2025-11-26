package platform

// AppInfo contains information about an application
type AppInfo struct {
	Name     string // Display name (e.g., "Microsoft Excel")
	BundleID string // Bundle identifier (e.g., "com.microsoft.Excel")
	Path     string // Application path (e.g., "/Applications/Microsoft Excel.app")
}

// Platform abstracts OS-specific operations for file handling
type Platform interface {
	// GetDefaultApp returns the default application for a given file extension
	GetDefaultApp(ext string) (AppInfo, error)

	// OpenWithDefault opens a file with its default application
	OpenWithDefault(path string) error

	// OpenWith opens a file with a specific application
	OpenWith(path string, appPath string) error
}

// New returns a Platform implementation for the current OS
func New() Platform {
	return newDarwinPlatform()
}
