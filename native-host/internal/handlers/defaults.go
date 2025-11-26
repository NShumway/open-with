package handlers

import (
	"github.com/reclaim/openwith/internal/messaging"
	"github.com/reclaim/openwith/internal/platform"
)

// supportedExtensions lists all file extensions we support
var supportedExtensions = []string{"xlsx", "docx", "pptx", "txt", "pdf"}

// HandleGetDefaults returns the default applications for all supported file types
func HandleGetDefaults(plat platform.Platform) messaging.Response {
	defaults := make(map[string]interface{})

	for _, ext := range supportedExtensions {
		app, err := plat.GetDefaultApp(ext)
		if err != nil {
			// If no default app, include in response with empty values
			defaults[ext] = map[string]string{
				"name":     "",
				"bundleId": "",
			}
			continue
		}
		defaults[ext] = map[string]string{
			"name":     app.Name,
			"bundleId": app.BundleID,
		}
	}

	return messaging.Response{
		Success:  true,
		Defaults: defaults,
	}
}
