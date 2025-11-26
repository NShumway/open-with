package main

import (
	"io"
	"log"
	"os"
	"path/filepath"

	"github.com/reclaim/openwith/internal/handlers"
	"github.com/reclaim/openwith/internal/messaging"
	"github.com/reclaim/openwith/internal/platform"
)

func main() {
	// Set up logging to a file in the user's cache directory
	// We can't use stderr as it may interfere with native messaging
	// Use user-specific directory and restricted permissions (owner read/write only)
	cacheDir, err := os.UserCacheDir()
	if err != nil {
		cacheDir = os.TempDir()
	}
	logDir := filepath.Join(cacheDir, "reclaim-openwith")
	_ = os.MkdirAll(logDir, 0700) // Create with restricted permissions
	logPath := filepath.Join(logDir, "reclaim-openwith.log")
	logFile, err := os.OpenFile(logPath, os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0600)
	if err == nil {
		defer logFile.Close()
		log.SetOutput(logFile)
	}

	log.Println("Native host started")

	// Initialize platform-specific implementation
	plat := platform.New()

	for {
		msg, err := messaging.ReadMessage(os.Stdin)
		if err == io.EOF {
			break
		}
		if err != nil {
			log.Printf("Error reading message: %v", err)
			break
		}

		response := handleMessage(msg, plat)
		if err := messaging.WriteMessage(os.Stdout, response); err != nil {
			log.Printf("Error writing response: %v", err)
			break
		}
	}
}

func handleMessage(msg *messaging.Message, plat platform.Platform) messaging.Response {
	switch msg.Action {
	case "getDefaults":
		return handlers.HandleGetDefaults(plat)
	case "open":
		return handlers.HandleOpen(msg, plat)
	case "ping":
		return messaging.Response{Success: true, Message: "pong"}
	default:
		return messaging.Response{
			Success: false,
			Error:   "unknown",
			Message: "Unknown action: " + msg.Action,
		}
	}
}
