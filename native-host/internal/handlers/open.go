package handlers

import (
	"os"
	"path/filepath"
	"regexp"
	"strings"

	"github.com/reclaim/openwith/internal/messaging"
	"github.com/reclaim/openwith/internal/platform"
)

// allowedExtensions defines the file extensions we accept
var allowedExtensions = map[string]bool{
	".xlsx": true,
	".docx": true,
	".pptx": true,
	".txt":  true,
	".pdf":  true,
}

// filenamePattern matches our expected filename format: openwith-{id}-{timestamp}.{ext}
var filenamePattern = regexp.MustCompile(`^openwith-[a-zA-Z0-9]+-\d+\.(xlsx|docx|pptx|txt|pdf)$`)

// validateFilePath ensures the file path is safe to process
// Returns an error message if validation fails, empty string if valid
func validateFilePath(filePath string) string {
	if filePath == "" {
		return "No file path provided"
	}

	// Resolve to absolute path and clean it
	absPath, err := filepath.Abs(filePath)
	if err != nil {
		return "Invalid file path"
	}

	// Evaluate any symlinks to get the real path
	realPath, err := filepath.EvalSymlinks(absPath)
	if err != nil {
		// File might not exist yet, but if we can't resolve symlinks on parent, that's suspicious
		if !os.IsNotExist(err) {
			return "Cannot resolve file path"
		}
		// For non-existent files, at least check the parent directory
		parentDir := filepath.Dir(absPath)
		if _, err := filepath.EvalSymlinks(parentDir); err != nil {
			return "Cannot resolve file path"
		}
		realPath = absPath
	}

	// Verify the path doesn't escape via symlinks to sensitive locations
	// Block paths to system directories
	sensitiveDirectories := []string{
		"/System",
		"/Library",
		"/usr",
		"/bin",
		"/sbin",
		"/etc",
		"/private/etc",
	}

	for _, sensitive := range sensitiveDirectories {
		if strings.HasPrefix(realPath, sensitive+"/") || realPath == sensitive {
			return "Access to system directories is not allowed"
		}
	}

	// Validate filename matches our expected pattern
	filename := filepath.Base(realPath)
	if !filenamePattern.MatchString(filename) {
		return "Invalid filename format"
	}

	// Validate extension is allowed
	ext := strings.ToLower(filepath.Ext(filename))
	if !allowedExtensions[ext] {
		return "Unsupported file type"
	}

	return ""
}

// HandleOpen opens a file with the default application directly from its current location.
// The file remains in the Downloads folder where Chrome placed it.
func HandleOpen(msg *messaging.Message, plat platform.Platform) messaging.Response {
	// Validate file path for security
	if errMsg := validateFilePath(msg.FilePath); errMsg != "" {
		return messaging.Response{
			Success: false,
			Error:   "file_not_found",
			Message: errMsg,
		}
	}

	// Validate file exists
	if _, err := os.Stat(msg.FilePath); os.IsNotExist(err) {
		return messaging.Response{
			Success: false,
			Error:   "file_not_found",
			Message: "The requested file could not be found",
		}
	}

	// Open with default application directly from Downloads
	if err := plat.OpenWithDefault(msg.FilePath); err != nil {
		return messaging.Response{
			Success:  false,
			Error:    "no_default_app",
			FileType: msg.FileType,
			Message:  "No application is configured to open this file type",
		}
	}

	return messaging.Response{
		Success: true,
	}
}
