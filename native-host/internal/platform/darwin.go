//go:build darwin

package platform

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"strings"
)

type darwinPlatform struct{}

func newDarwinPlatform() *darwinPlatform {
	return &darwinPlatform{}
}

// validatePath ensures a path is safe for command execution
// Returns the cleaned absolute path and an error if validation fails
func validatePath(path string) (string, error) {
	if path == "" {
		return "", fmt.Errorf("empty path")
	}

	// Get absolute path
	absPath, err := filepath.Abs(path)
	if err != nil {
		return "", fmt.Errorf("invalid path: %w", err)
	}

	// Clean the path to remove any . or .. components
	cleanPath := filepath.Clean(absPath)

	// Ensure the path doesn't contain null bytes or other control characters
	for _, r := range cleanPath {
		if r < 32 || r == 127 {
			return "", fmt.Errorf("path contains invalid characters")
		}
	}

	return cleanPath, nil
}

// validateAppPath ensures an application path is valid
func validateAppPath(appPath string) (string, error) {
	cleanPath, err := validatePath(appPath)
	if err != nil {
		return "", err
	}

	// App paths should end with .app and be in expected locations
	if !strings.HasSuffix(cleanPath, ".app") {
		return "", fmt.Errorf("invalid application path")
	}

	// Verify it's a real directory (apps are directories on macOS)
	info, err := os.Stat(cleanPath)
	if err != nil {
		return "", fmt.Errorf("application not found")
	}
	if !info.IsDir() {
		return "", fmt.Errorf("invalid application")
	}

	return cleanPath, nil
}

// extensionPattern validates file extensions (alphanumeric only)
var extensionPattern = regexp.MustCompile(`^[a-zA-Z0-9]+$`)

// GetDefaultApp returns the default application for a file extension on macOS.
// Uses osascript/System Events to find the default app.
func (p *darwinPlatform) GetDefaultApp(ext string) (AppInfo, error) {
	ext = strings.TrimPrefix(ext, ".")
	if ext == "" {
		return AppInfo{}, fmt.Errorf("empty extension")
	}

	// Validate extension contains only safe characters
	if !extensionPattern.MatchString(ext) {
		return AppInfo{}, fmt.Errorf("invalid extension format")
	}

	// Create a temp file to query (needs to exist for System Events)
	tempPath := filepath.Join(os.TempDir(), "query."+ext)
	f, err := os.Create(tempPath)
	if err != nil {
		return AppInfo{}, fmt.Errorf("failed to create temp file: %w", err)
	}
	f.Close()
	defer os.Remove(tempPath)

	// Use osascript to query System Events for the default app
	// Returns format: "alias Macintosh HD:Applications:Numbers.app:"
	script := fmt.Sprintf(`tell application "System Events" to get default application of (info for (POSIX file "%s"))`, tempPath)
	cmd := exec.Command("osascript", "-e", script)
	output, err := cmd.Output()
	if err != nil {
		return AppInfo{}, fmt.Errorf("no default app for .%s", ext)
	}

	// Parse the alias format: "alias Macintosh HD:Applications:Numbers.app:"
	aliasStr := strings.TrimSpace(string(output))
	if aliasStr == "" || !strings.HasPrefix(aliasStr, "alias ") {
		return AppInfo{}, fmt.Errorf("no default app for .%s", ext)
	}

	// Extract app name from HFS path (e.g., "...Numbers.app:" -> "Numbers")
	// Find the last component before .app:
	parts := strings.Split(aliasStr, ":")
	var appName string
	for _, part := range parts {
		if strings.HasSuffix(part, ".app") {
			appName = strings.TrimSuffix(part, ".app")
			break
		}
	}
	if appName == "" {
		return AppInfo{}, fmt.Errorf("could not parse app name for .%s", ext)
	}

	// Convert HFS path to POSIX path for bundle ID lookup
	// "alias Macintosh HD:Applications:Numbers.app:" -> "/Applications/Numbers.app"
	hfsPath := strings.TrimPrefix(aliasStr, "alias ")
	hfsPath = strings.TrimSuffix(hfsPath, ":")
	// Remove volume name and convert : to /
	colonIdx := strings.Index(hfsPath, ":")
	if colonIdx >= 0 {
		hfsPath = hfsPath[colonIdx:]
	}
	appPath := strings.ReplaceAll(hfsPath, ":", "/")

	// Get bundle ID using mdls
	bundleID := p.getBundleID(appPath)

	return AppInfo{
		Name:     appName,
		BundleID: bundleID,
		Path:     appPath,
	}, nil
}

// getBundleID extracts the bundle identifier from an app using mdls
func (p *darwinPlatform) getBundleID(appPath string) string {
	cmd := exec.Command("mdls", "-name", "kMDItemCFBundleIdentifier", "-raw", appPath)
	output, err := cmd.Output()
	if err != nil {
		return ""
	}
	bundleID := strings.TrimSpace(string(output))
	if bundleID == "(null)" {
		return ""
	}
	return bundleID
}

// OpenWithDefault opens a file with its default application
func (p *darwinPlatform) OpenWithDefault(path string) error {
	// Validate and clean the path before execution
	cleanPath, err := validatePath(path)
	if err != nil {
		return fmt.Errorf("invalid file path: %w", err)
	}

	// Verify the file exists
	if _, err := os.Stat(cleanPath); err != nil {
		return fmt.Errorf("file not accessible: %w", err)
	}

	cmd := exec.Command("open", cleanPath)
	return cmd.Run()
}

// OpenWith opens a file with a specific application
func (p *darwinPlatform) OpenWith(path string, appPath string) error {
	// Validate file path
	cleanPath, err := validatePath(path)
	if err != nil {
		return fmt.Errorf("invalid file path: %w", err)
	}

	// Validate application path
	cleanAppPath, err := validateAppPath(appPath)
	if err != nil {
		return fmt.Errorf("invalid application: %w", err)
	}

	// Verify the file exists
	if _, err := os.Stat(cleanPath); err != nil {
		return fmt.Errorf("file not accessible: %w", err)
	}

	cmd := exec.Command("open", "-a", cleanAppPath, cleanPath)
	return cmd.Run()
}

