package handlers

import (
	"errors"
	"os"
	"path/filepath"
	"testing"

	"github.com/reclaim/openwith/internal/messaging"
	"github.com/reclaim/openwith/internal/platform"
)

// MockPlatform implements platform.Platform for testing
type MockPlatform struct {
	DefaultApps     map[string]platform.AppInfo
	GetDefaultErr   error
	OpenErr         error
	OpenedFiles     []string
	OpenWithAppPath string
}

func (m *MockPlatform) GetDefaultApp(ext string) (platform.AppInfo, error) {
	if m.GetDefaultErr != nil {
		return platform.AppInfo{}, m.GetDefaultErr
	}
	if app, ok := m.DefaultApps[ext]; ok {
		return app, nil
	}
	return platform.AppInfo{}, errors.New("no default app")
}

func (m *MockPlatform) OpenWithDefault(path string) error {
	if m.OpenErr != nil {
		return m.OpenErr
	}
	m.OpenedFiles = append(m.OpenedFiles, path)
	return nil
}

func (m *MockPlatform) OpenWith(path string, appPath string) error {
	m.OpenWithAppPath = appPath
	return m.OpenWithDefault(path)
}

func TestHandleGetDefaults_AllAppsConfigured(t *testing.T) {
	mock := &MockPlatform{
		DefaultApps: map[string]platform.AppInfo{
			"xlsx": {Name: "Microsoft Excel", BundleID: "com.microsoft.Excel"},
			"docx": {Name: "Microsoft Word", BundleID: "com.microsoft.Word"},
			"pptx": {Name: "Microsoft PowerPoint", BundleID: "com.microsoft.PowerPoint"},
			"txt":  {Name: "TextEdit", BundleID: "com.apple.TextEdit"},
			"pdf":  {Name: "Preview", BundleID: "com.apple.Preview"},
		},
	}

	resp := HandleGetDefaults(mock)

	if !resp.Success {
		t.Errorf("Expected success=true, got false")
	}

	if resp.Defaults == nil {
		t.Fatal("Expected defaults to be set")
	}

	// Check xlsx
	xlsx, ok := resp.Defaults["xlsx"].(map[string]string)
	if !ok {
		t.Fatal("Expected xlsx to be map[string]string")
	}
	if xlsx["name"] != "Microsoft Excel" {
		t.Errorf("Expected xlsx name 'Microsoft Excel', got '%s'", xlsx["name"])
	}
	if xlsx["bundleId"] != "com.microsoft.Excel" {
		t.Errorf("Expected xlsx bundleId 'com.microsoft.Excel', got '%s'", xlsx["bundleId"])
	}
}

func TestHandleGetDefaults_SomeMissing(t *testing.T) {
	mock := &MockPlatform{
		DefaultApps: map[string]platform.AppInfo{
			"xlsx": {Name: "Microsoft Excel", BundleID: "com.microsoft.Excel"},
			// docx, pptx, txt, pdf missing
		},
	}

	resp := HandleGetDefaults(mock)

	if !resp.Success {
		t.Errorf("Expected success=true even with missing apps")
	}

	// xlsx should have values
	xlsx := resp.Defaults["xlsx"].(map[string]string)
	if xlsx["name"] != "Microsoft Excel" {
		t.Errorf("Expected xlsx name, got '%s'", xlsx["name"])
	}

	// docx should have empty values
	docx := resp.Defaults["docx"].(map[string]string)
	if docx["name"] != "" {
		t.Errorf("Expected empty docx name, got '%s'", docx["name"])
	}
	if docx["bundleId"] != "" {
		t.Errorf("Expected empty docx bundleId, got '%s'", docx["bundleId"])
	}
}

func TestHandleOpen_Success(t *testing.T) {
	// Create a temp directory for this test
	tempDir := t.TempDir()

	// Create a test file with valid filename pattern (open-with-{title}.{ext})
	testFile := filepath.Join(tempDir, "open-with-Q4 Budget.xlsx")
	if err := os.WriteFile(testFile, []byte("test content"), 0644); err != nil {
		t.Fatalf("Failed to create test file: %v", err)
	}

	mock := &MockPlatform{}

	msg := &messaging.Message{
		Action:   "open",
		FilePath: testFile,
		FileType: "xlsx",
	}

	resp := HandleOpen(msg, mock)

	if !resp.Success {
		t.Errorf("Expected success=true, got false: %s", resp.Message)
	}

	// File should have been opened directly (not moved)
	if len(mock.OpenedFiles) != 1 {
		t.Errorf("Expected 1 opened file, got %d", len(mock.OpenedFiles))
	}

	// The opened file should be the original file path
	if mock.OpenedFiles[0] != testFile {
		t.Errorf("Expected opened file to be %s, got %s", testFile, mock.OpenedFiles[0])
	}

	// Original file should still exist (not moved)
	if _, err := os.Stat(testFile); os.IsNotExist(err) {
		t.Error("Original file should still exist")
	}
}

func TestHandleOpen_FileNotFound(t *testing.T) {
	mock := &MockPlatform{}

	// Use valid filename format but non-existent path
	msg := &messaging.Message{
		Action:   "open",
		FilePath: "/nonexistent/open-with-Test Document.xlsx",
		FileType: "xlsx",
	}

	resp := HandleOpen(msg, mock)

	if resp.Success {
		t.Error("Expected success=false for non-existent file")
	}

	if resp.Error != "file_not_found" {
		t.Errorf("Expected error 'file_not_found', got '%s'", resp.Error)
	}
}

func TestHandleOpen_EmptyFilePath(t *testing.T) {
	mock := &MockPlatform{}

	msg := &messaging.Message{
		Action:   "open",
		FilePath: "",
		FileType: "xlsx",
	}

	resp := HandleOpen(msg, mock)

	if resp.Success {
		t.Error("Expected success=false for empty file path")
	}

	if resp.Error != "file_not_found" {
		t.Errorf("Expected error 'file_not_found', got '%s'", resp.Error)
	}
}

func TestHandleOpen_OpenError(t *testing.T) {
	tempDir := t.TempDir()

	// Use valid filename format
	testFile := filepath.Join(tempDir, "open-with-Meeting Notes.xlsx")
	if err := os.WriteFile(testFile, []byte("test content"), 0644); err != nil {
		t.Fatalf("Failed to create test file: %v", err)
	}

	mock := &MockPlatform{
		OpenErr: errors.New("failed to open"),
	}

	msg := &messaging.Message{
		Action:   "open",
		FilePath: testFile,
		FileType: "xlsx",
	}

	resp := HandleOpen(msg, mock)

	if resp.Success {
		t.Error("Expected success=false when open fails")
	}

	if resp.Error != "no_default_app" {
		t.Errorf("Expected error 'no_default_app', got '%s'", resp.Error)
	}

	if resp.FileType != "xlsx" {
		t.Errorf("Expected fileType 'xlsx', got '%s'", resp.FileType)
	}
}


func TestHandleOpen_InvalidFilenameFormat(t *testing.T) {
	tempDir := t.TempDir()

	// Create a file with invalid filename format (not matching open-with-* pattern)
	testFile := filepath.Join(tempDir, "malicious-file.xlsx")
	if err := os.WriteFile(testFile, []byte("test content"), 0644); err != nil {
		t.Fatalf("Failed to create test file: %v", err)
	}

	mock := &MockPlatform{}

	msg := &messaging.Message{
		Action:   "open",
		FilePath: testFile,
		FileType: "xlsx",
	}

	resp := HandleOpen(msg, mock)

	if resp.Success {
		t.Error("Expected success=false for invalid filename format")
	}

	if resp.Error != "file_not_found" {
		t.Errorf("Expected error 'file_not_found', got '%s'", resp.Error)
	}
}

func TestHandleOpen_SystemDirectoryBlocked(t *testing.T) {
	mock := &MockPlatform{}

	// Try to access a file in a system directory (even with valid filename)
	msg := &messaging.Message{
		Action:   "open",
		FilePath: "/usr/local/open-with-System File.xlsx",
		FileType: "xlsx",
	}

	resp := HandleOpen(msg, mock)

	if resp.Success {
		t.Error("Expected success=false for system directory access")
	}

	if resp.Error != "file_not_found" {
		t.Errorf("Expected error 'file_not_found', got '%s'", resp.Error)
	}
}
