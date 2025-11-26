//go:build darwin

package platform

import (
	"os"
	"strings"
	"testing"
)

func TestGetDefaultApp(t *testing.T) {
	p := New()

	// Test empty extension - should always error
	t.Run("empty extension", func(t *testing.T) {
		_, err := p.GetDefaultApp("")
		if err == nil {
			t.Error("GetDefaultApp(\"\") expected error, got nil")
		}
	})

	// Test nonexistent extension - should error
	t.Run("nonexistent extension", func(t *testing.T) {
		_, err := p.GetDefaultApp("zzznonexistent999")
		if err == nil {
			t.Error("GetDefaultApp(\"zzznonexistent999\") expected error, got nil")
		}
	})

	// Test common extensions - may or may not have default apps configured
	// These tests verify the function works, not that apps exist
	extensions := []string{"txt", ".txt", "html", "pdf"}
	for _, ext := range extensions {
		t.Run("extension_"+ext, func(t *testing.T) {
			info, err := p.GetDefaultApp(ext)
			if err != nil {
				// Not an error - system may not have default apps configured
				t.Logf("GetDefaultApp(%q): no default app configured (this is OK): %v", ext, err)
				return
			}

			// If we got a result, verify it's valid
			if info.Name == "" {
				t.Errorf("GetDefaultApp(%q) returned empty Name", ext)
			}
			if info.Path == "" {
				t.Errorf("GetDefaultApp(%q) returned empty Path", ext)
			}
			if !strings.HasSuffix(info.Path, ".app") {
				t.Errorf("GetDefaultApp(%q) Path doesn't end with .app: %s", ext, info.Path)
			}

			t.Logf("Default app for .%s: %s (%s) at %s", ext, info.Name, info.BundleID, info.Path)
		})
	}
}

func TestOpenWithDefault(t *testing.T) {
	// Skip in CI environments
	if os.Getenv("CI") != "" {
		t.Skip("Skipping OpenWithDefault test in CI")
	}

	p := New()

	// Create a temp file
	tmpFile, err := os.CreateTemp("", "platform-test-*.txt")
	if err != nil {
		t.Fatalf("Failed to create temp file: %v", err)
	}
	defer os.Remove(tmpFile.Name())

	if _, err := tmpFile.WriteString("test content"); err != nil {
		t.Fatalf("Failed to write to temp file: %v", err)
	}
	tmpFile.Close()

	// This will actually open the file, so we just verify no error
	// In a real test environment, you might want to skip this
	t.Skip("Skipping OpenWithDefault - would open actual application")

	if err := p.OpenWithDefault(tmpFile.Name()); err != nil {
		t.Errorf("OpenWithDefault() error: %v", err)
	}
}

func TestOpenWith(t *testing.T) {
	// Skip - would actually open applications
	t.Skip("Skipping OpenWith - would open actual application")
}


func TestGetBundleID(t *testing.T) {
	p := newDarwinPlatform()

	// Test with a known application
	bundleID := p.getBundleID("/System/Applications/TextEdit.app")
	if bundleID == "" {
		// Try alternate location
		bundleID = p.getBundleID("/Applications/TextEdit.app")
	}

	// TextEdit should exist on all macOS systems
	if bundleID != "" && bundleID != "com.apple.TextEdit" {
		t.Logf("TextEdit bundle ID: %s (expected com.apple.TextEdit)", bundleID)
	}

	// Test with invalid path
	bundleID = p.getBundleID("/nonexistent/app.app")
	// Should return empty string, not error
	t.Logf("Invalid path bundle ID: %q (expected empty)", bundleID)
}
