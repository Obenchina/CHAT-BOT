#!/usr/bin/env python3
"""
Whisper Audio Transcription Script
Transcribes audio files to Arabic text using local Whisper model
"""

import sys
import os
import static_ffmpeg # type: ignore

# Add ffmpeg to path
static_ffmpeg.add_paths()

import whisper # type: ignore

def transcribe_audio(audio_path, model_name="small"):
    """
    Transcribe audio file to text using Whisper model
    
    Args:
        audio_path: Path to audio file (wav, mp3, webm, ogg)
        model_name: Whisper model to use (tiny, base, small, medium, large)
    
    Returns:
        Transcribed text in Arabic
    """
    try:
        # Check if file exists
        if not os.path.exists(audio_path):
            print(f"ERROR: File not found: {audio_path}", file=sys.stderr)
            return None
        
        # Load model (will download on first use)
        print(f"Loading Whisper {model_name} model...", file=sys.stderr)
        model = whisper.load_model(model_name)
        
        # Check ffmpeg
        import subprocess
        try:
            print("Checking ffmpeg...", file=sys.stderr)
            subprocess.run(["ffmpeg", "-version"], check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
            print("ffmpeg found via subprocess", file=sys.stderr)
        except Exception as e:
            print(f"WARNING: ffmpeg check failed: {e}", file=sys.stderr)

        # Check audio info
        try:
            print("Checking audio info...", file=sys.stderr)
            probe = subprocess.run(
                ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", audio_path],
                check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE
            )
            duration = float(probe.stdout.decode().strip())
            print(f"Audio duration: {duration} seconds", file=sys.stderr)
        except Exception as e:
            print(f"WARNING: ffprobe failed: {e}", file=sys.stderr)

        # Reconfigure stderr to utf-8
        if hasattr(sys.stderr, 'reconfigure'):
            sys.stderr.reconfigure(encoding='utf-8') # type: ignore

        # Transcribe audio
        print(f"Transcribing: {audio_path}", file=sys.stderr)
        result = model.transcribe(
            audio_path,
            language="ar",  # Arabic
            task="transcribe",
            fp16=False,  # CPU mode
            verbose=False, # Disable verbose to avoid encoding issues with progress bar/text
            initial_prompt="هذا تسجيل طبي لمريض يسرد أعراضه." # Provide context to help Whisper
        )
        
        # Return transcribed text
        text = result["text"].strip()
        print(f"Transcription complete: {len(text)} characters", file=sys.stderr)
        if len(text) == 0:
            print(f"Full result: {result}", file=sys.stderr)
        return text
        
    except Exception as e:
        print(f"ERROR: {str(e)}", file=sys.stderr)
        return None

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python whisper_transcribe.py <audio_file> [model_name]", file=sys.stderr)
        sys.exit(1)
    
    audio_file = sys.argv[1]
    model = sys.argv[2] if len(sys.argv) > 2 else "small"
    
    result = transcribe_audio(audio_file, model)
    
    if result:
        # Print result to stdout (will be captured by Node.js)
        # Using utf-8 encoding for stdout to handle Arabic text correctly
        if hasattr(sys.stdout, 'reconfigure'):
            sys.stdout.reconfigure(encoding='utf-8') # type: ignore
        print(result)
        sys.exit(0)
    else:
        sys.exit(1)
