import { supabaseAdmin } from '@/lib/supabase';

export interface TTSOptions {
  text: string;
  voice?: string;
  language?: string;
  speed?: number;
  provider?: 'elevenlabs' | 'google' | 'azure';
}

export interface STTOptions {
  audio: Buffer | string; // Base64 or Buffer
  language?: string;
  provider?: 'google' | 'whisper' | 'azure';
}

export class VoiceService {
  // Text to Speech
  async textToSpeech(options: TTSOptions): Promise<Buffer> {
    const { text, voice = 'default', language = 'en-US', speed = 1.0, provider = 'elevenlabs' } = options;

    try {
      switch (provider) {
        case 'elevenlabs':
          return await this.elevenLabsTTS(text, voice, speed);
        case 'google':
          return await this.googleTTS(text, voice, language, speed);
        default:
          throw new Error(`Unsupported TTS provider: ${provider}`);
      }
    } catch (error: any) {
      console.error('TTS error:', error);
      throw new Error(`Text-to-speech failed: ${error.message}`);
    }
  }

  // Speech to Text
  async speechToText(options: STTOptions): Promise<string> {
    const { audio, language = 'en-US', provider = 'whisper' } = options;

    try {
      // Convert base64 to buffer if needed
      const audioBuffer = typeof audio === 'string' 
        ? Buffer.from(audio, 'base64')
        : audio;

      switch (provider) {
        case 'whisper':
          return await this.whisperSTT(audioBuffer, language);
        case 'google':
          return await this.googleSTT(audioBuffer, language);
        default:
          throw new Error(`Unsupported STT provider: ${provider}`);
      }
    } catch (error: any) {
      console.error('STT error:', error);
      throw new Error(`Speech-to-text failed: ${error.message}`);
    }
  }

  // ElevenLabs TTS implementation
  private async elevenLabsTTS(text: string, voice: string, speed: number): Promise<Buffer> {
    const apiKey = process.env.ELEVENLABS_API_KEY;
    if (!apiKey) {
      throw new Error('ElevenLabs API key not configured');
    }

    // Map voice names to ElevenLabs voice IDs
    const voiceMap: Record<string, string> = {
      'default': '21m00Tcm4TlvDq8ikWAM',
      'rachel': '21m00Tcm4TlvDq8ikWAM',
      'adam': 'pNInz6obpgDQGcFmaJgB',
      'antoni': 'ErXwobaYiN019PkySvjV',
      'arnold': 'VR6AewLTigWG4xSOukaG',
      'bella': 'EXAVITQu4vr4xnSDxMaL',
    };

    const voiceId = voiceMap[voice] || voiceMap['default'];

    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
      method: 'POST',
      headers: {
        'xi-api-key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text,
        model_id: 'eleven_monolingual_v1',
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.5,
          speed,
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`ElevenLabs API error: ${response.statusText}`);
    }

    const audioBuffer = await response.arrayBuffer();
    return Buffer.from(audioBuffer);
  }

  // Google Cloud TTS implementation
  private async googleTTS(text: string, voice: string, language: string, speed: number): Promise<Buffer> {
    // This would require Google Cloud Text-to-Speech setup
    // For now, returning a placeholder
    throw new Error('Google TTS not yet implemented');
  }

  // OpenAI Whisper STT implementation
  private async whisperSTT(audioBuffer: Buffer, language: string): Promise<string> {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OpenAI API key not configured');
    }

    // Create form data
    const formData = new FormData();
    const blob = new Blob([audioBuffer], { type: 'audio/wav' });
    formData.append('file', blob, 'audio.wav');
    formData.append('model', 'whisper-1');
    if (language !== 'auto') {
      formData.append('language', language.split('-')[0]); // Convert en-US to en
    }

    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`Whisper API error: ${response.statusText}`);
    }

    const result = await response.json();
    return result.text;
  }

  // Google Cloud STT implementation
  private async googleSTT(audioBuffer: Buffer, language: string): Promise<string> {
    // This would require Google Cloud Speech-to-Text setup
    // For now, returning a placeholder
    throw new Error('Google STT not yet implemented');
  }

  // Get available voices
  async getAvailableVoices(provider: string = 'elevenlabs'): Promise<any[]> {
    switch (provider) {
      case 'elevenlabs':
        return [
          { id: 'rachel', name: 'Rachel', gender: 'female', language: 'en-US' },
          { id: 'adam', name: 'Adam', gender: 'male', language: 'en-US' },
          { id: 'antoni', name: 'Antoni', gender: 'male', language: 'en-US' },
          { id: 'arnold', name: 'Arnold', gender: 'male', language: 'en-US' },
          { id: 'bella', name: 'Bella', gender: 'female', language: 'en-US' },
        ];
      default:
        return [];
    }
  }

  // Track voice usage
  async trackVoiceUsage(userId: string, type: 'tts' | 'stt', duration: number): Promise<void> {
    try {
      await supabaseAdmin
        .from('voice_usage')
        .insert({
          user_id: userId,
          type,
          duration_seconds: duration,
          timestamp: new Date().toISOString(),
        });
    } catch (error) {
      console.error('Failed to track voice usage:', error);
    }
  }
}

export const voiceService = new VoiceService();