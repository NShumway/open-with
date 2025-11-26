package messaging

import (
	"encoding/binary"
	"encoding/json"
	"fmt"
	"io"
)

const (
	// MaxMessageSize is the maximum allowed message size (1MB)
	MaxMessageSize = 1024 * 1024
)

// Message represents a native messaging protocol message from the extension
type Message struct {
	Action   string                 `json:"action"`
	FilePath string                 `json:"filePath,omitempty"`
	FileType string                 `json:"fileType,omitempty"`
	Data     map[string]interface{} `json:"data,omitempty"`
}

// Response represents a response to send back to the extension
type Response struct {
	Success  bool                   `json:"success"`
	Error    string                 `json:"error,omitempty"`
	FileType string                 `json:"fileType,omitempty"`
	Message  string                 `json:"message,omitempty"`
	Defaults map[string]interface{} `json:"defaults,omitempty"`
}

// ReadMessage reads a length-prefixed JSON message from the given reader.
// Chrome's native messaging protocol uses a 32-bit little-endian length prefix.
func ReadMessage(r io.Reader) (*Message, error) {
	var length uint32
	if err := binary.Read(r, binary.LittleEndian, &length); err != nil {
		if err == io.EOF {
			return nil, err
		}
		return nil, fmt.Errorf("failed to read message length: %w", err)
	}

	if length == 0 {
		return nil, fmt.Errorf("invalid message length: 0")
	}
	if length > MaxMessageSize {
		return nil, fmt.Errorf("message too large: %d bytes (max %d)", length, MaxMessageSize)
	}

	buf := make([]byte, length)
	if _, err := io.ReadFull(r, buf); err != nil {
		return nil, fmt.Errorf("failed to read message body: %w", err)
	}

	var msg Message
	if err := json.Unmarshal(buf, &msg); err != nil {
		return nil, fmt.Errorf("failed to unmarshal message: %w", err)
	}

	return &msg, nil
}

// WriteMessage writes a length-prefixed JSON response to the given writer.
// Chrome's native messaging protocol uses a 32-bit little-endian length prefix.
func WriteMessage(w io.Writer, resp Response) error {
	data, err := json.Marshal(resp)
	if err != nil {
		return fmt.Errorf("failed to marshal response: %w", err)
	}

	length := uint32(len(data))
	if err := binary.Write(w, binary.LittleEndian, length); err != nil {
		return fmt.Errorf("failed to write message length: %w", err)
	}

	if _, err := w.Write(data); err != nil {
		return fmt.Errorf("failed to write message body: %w", err)
	}

	return nil
}
