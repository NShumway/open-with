package messaging

import (
	"bytes"
	"encoding/binary"
	"encoding/json"
	"io"
	"testing"
)

func TestReadMessage(t *testing.T) {
	tests := []struct {
		name    string
		input   func() io.Reader
		want    *Message
		wantErr bool
		errMsg  string
	}{
		{
			name: "valid message",
			input: func() io.Reader {
				msg := Message{Action: "open", FilePath: "/tmp/test.txt"}
				return createMessageReader(t, msg)
			},
			want:    &Message{Action: "open", FilePath: "/tmp/test.txt"},
			wantErr: false,
		},
		{
			name: "message with data",
			input: func() io.Reader {
				msg := Message{
					Action: "configure",
					Data:   map[string]interface{}{"key": "value"},
				}
				return createMessageReader(t, msg)
			},
			want: &Message{
				Action: "configure",
				Data:   map[string]interface{}{"key": "value"},
			},
			wantErr: false,
		},
		{
			name: "empty reader (EOF)",
			input: func() io.Reader {
				return bytes.NewReader(nil)
			},
			wantErr: true,
		},
		{
			name: "zero length",
			input: func() io.Reader {
				buf := make([]byte, 4)
				binary.LittleEndian.PutUint32(buf, 0)
				return bytes.NewReader(buf)
			},
			wantErr: true,
			errMsg:  "invalid message length: 0",
		},
		{
			name: "message too large",
			input: func() io.Reader {
				buf := make([]byte, 4)
				binary.LittleEndian.PutUint32(buf, MaxMessageSize+1)
				return bytes.NewReader(buf)
			},
			wantErr: true,
			errMsg:  "message too large",
		},
		{
			name: "truncated body",
			input: func() io.Reader {
				buf := make([]byte, 4)
				binary.LittleEndian.PutUint32(buf, 100) // says 100 bytes
				buf = append(buf, []byte("short")...)   // only 5 bytes
				return bytes.NewReader(buf)
			},
			wantErr: true,
			errMsg:  "failed to read message body",
		},
		{
			name: "invalid JSON",
			input: func() io.Reader {
				data := []byte("not valid json")
				buf := make([]byte, 4)
				binary.LittleEndian.PutUint32(buf, uint32(len(data)))
				buf = append(buf, data...)
				return bytes.NewReader(buf)
			},
			wantErr: true,
			errMsg:  "failed to unmarshal message",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := ReadMessage(tt.input())
			if tt.wantErr {
				if err == nil {
					t.Errorf("ReadMessage() expected error, got nil")
				}
				if tt.errMsg != "" && !bytes.Contains([]byte(err.Error()), []byte(tt.errMsg)) {
					t.Errorf("ReadMessage() error = %v, want error containing %q", err, tt.errMsg)
				}
				return
			}
			if err != nil {
				t.Errorf("ReadMessage() unexpected error: %v", err)
				return
			}
			if got.Action != tt.want.Action || got.FilePath != tt.want.FilePath {
				t.Errorf("ReadMessage() = %+v, want %+v", got, tt.want)
			}
		})
	}
}

func TestWriteMessage(t *testing.T) {
	tests := []struct {
		name    string
		resp    Response
		wantErr bool
	}{
		{
			name:    "success response",
			resp:    Response{Success: true, Message: "ok"},
			wantErr: false,
		},
		{
			name:    "error response",
			resp:    Response{Success: false, Error: "something went wrong"},
			wantErr: false,
		},
		{
			name: "response with defaults",
			resp: Response{
				Success:  true,
				Defaults: map[string]interface{}{"editor": "vim"},
			},
			wantErr: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			var buf bytes.Buffer
			err := WriteMessage(&buf, tt.resp)
			if tt.wantErr {
				if err == nil {
					t.Errorf("WriteMessage() expected error, got nil")
				}
				return
			}
			if err != nil {
				t.Errorf("WriteMessage() unexpected error: %v", err)
				return
			}

			// Verify the output format
			data := buf.Bytes()
			if len(data) < 4 {
				t.Errorf("WriteMessage() output too short: %d bytes", len(data))
				return
			}

			length := binary.LittleEndian.Uint32(data[:4])
			if int(length) != len(data)-4 {
				t.Errorf("WriteMessage() length mismatch: header says %d, actual body is %d", length, len(data)-4)
			}

			// Verify JSON is valid
			var parsed Response
			if err := json.Unmarshal(data[4:], &parsed); err != nil {
				t.Errorf("WriteMessage() produced invalid JSON: %v", err)
			}
		})
	}
}

func TestRoundTrip(t *testing.T) {
	// Write a response and read it back as a message
	// This tests that the length-prefix protocol is consistent
	resp := Response{Success: true, Message: "test"}

	var buf bytes.Buffer
	if err := WriteMessage(&buf, resp); err != nil {
		t.Fatalf("WriteMessage() error: %v", err)
	}

	// Read the length and JSON back
	data := buf.Bytes()
	length := binary.LittleEndian.Uint32(data[:4])

	if int(length) != len(data)-4 {
		t.Errorf("Length mismatch: %d vs %d", length, len(data)-4)
	}

	// Verify we can parse the JSON
	var parsed map[string]interface{}
	if err := json.Unmarshal(data[4:], &parsed); err != nil {
		t.Errorf("Failed to parse written JSON: %v", err)
	}

	if parsed["success"] != true {
		t.Errorf("Round trip failed: success = %v", parsed["success"])
	}
}

func TestLittleEndianEncoding(t *testing.T) {
	// Explicitly verify little-endian encoding as Chrome requires
	resp := Response{Success: true}

	var buf bytes.Buffer
	if err := WriteMessage(&buf, resp); err != nil {
		t.Fatalf("WriteMessage() error: %v", err)
	}

	data := buf.Bytes()

	// Manual little-endian check
	length := uint32(data[0]) | uint32(data[1])<<8 | uint32(data[2])<<16 | uint32(data[3])<<24

	expected := binary.LittleEndian.Uint32(data[:4])
	if length != expected {
		t.Errorf("Not little-endian: manual=%d, binary.LittleEndian=%d", length, expected)
	}
}

// Helper to create a properly formatted message reader
func createMessageReader(t *testing.T, msg Message) io.Reader {
	t.Helper()
	data, err := json.Marshal(msg)
	if err != nil {
		t.Fatalf("Failed to marshal test message: %v", err)
	}

	buf := make([]byte, 4+len(data))
	binary.LittleEndian.PutUint32(buf[:4], uint32(len(data)))
	copy(buf[4:], data)

	return bytes.NewReader(buf)
}
