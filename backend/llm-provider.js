/**
 * llm-provider.js — Multi-LLM abstraction layer
 *
 * Supports: DeepSeek, Anthropic Claude, OpenAI, Groq
 * Selection via LLM_PROVIDER env var (deploy-time, not runtime-switchable by end users).
 * Each provider has its own API key env var.
 *
 * Normalizes all provider-specific tool-calling formats into a single
 * OpenAI-compatible interface so the agent loop doesn't need to change.
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const axios = require('axios');

// ── Provider Registry ─────────────────────────────────────────────────

const PROVIDERS = {
  deepseek: {
    name: 'DeepSeek',
    model: 'deepseek-chat',
    baseURL: 'https://api.deepseek.com/v1',
    apiKeyEnv: 'DEEPSEEK_API_KEY',
    authHeader: (key) => `Bearer ${key}`,
    // DeepSeek uses OpenAI-compatible format natively
    format: 'openai',
    defaultTemperature: 0.3,
    defaultMaxTokens: 2000
  },
  openai: {
    name: 'OpenAI',
    model: 'gpt-4o',
    baseURL: 'https://api.openai.com/v1',
    apiKeyEnv: 'OPENAI_API_KEY',
    authHeader: (key) => `Bearer ${key}`,
    format: 'openai',
    defaultTemperature: 0.3,
    defaultMaxTokens: 2000
  },
  groq: {
    name: 'Groq',
    model: 'llama-3.1-70b-versatile',
    baseURL: 'https://api.groq.com/openai/v1',
    apiKeyEnv: 'GROQ_API_KEY',
    authHeader: (key) => `Bearer ${key}`,
    // Groq is OpenAI-compatible (chat completions + tools)
    format: 'openai',
    defaultTemperature: 0.3,
    defaultMaxTokens: 2000
  },
  claude: {
    name: 'Anthropic Claude',
    model: 'claude-3-5-sonnet-20241022',
    baseURL: 'https://api.anthropic.com/v1',
    apiKeyEnv: 'ANTHROPIC_API_KEY',
    authHeader: (key) => key, // Anthropic uses x-api-key header, not Authorization
    // Anthropic has a fundamentally different API format
    format: 'anthropic',
    defaultTemperature: 0.3,
    defaultMaxTokens: 2000,
    // Anthropic version header
    anthropicVersion: '2023-06-01'
  }
};

// ── Provider Factory ──────────────────────────────────────────────────

function createProvider(providerName) {
  const name = (providerName || process.env.LLM_PROVIDER || 'deepseek').toLowerCase();
  const config = PROVIDERS[name];

  if (!config) {
    throw new Error(
      `Unknown LLM provider: "${name}". ` +
      `Set LLM_PROVIDER to one of: ${Object.keys(PROVIDERS).join(', ')}`
    );
  }

  const apiKey = process.env[config.apiKeyEnv];
  if (!apiKey) {
    console.warn(
      `[llm-provider] ${config.apiKeyEnv} not set. ` +
      `Agent will use local fallback for ${name}.`
    );
  }

  // Return the appropriate handler based on format
  if (config.format === 'anthropic') {
    return createAnthropicProvider(config, apiKey);
  }
  return createOpenAICompatibleProvider(config, apiKey);
}

// ── OpenAI-compatible handler (DeepSeek, OpenAI, Groq) ────────────────

function createOpenAICompatibleProvider(config, apiKey) {
  return {
    name: config.name,
    model: config.model,

    /**
     * Send a chat completion request with tools.
     * @param {Array} messages - OpenAI-format messages [{role, content}]
     * @param {Array} tools - OpenAI-format tools [{type: 'function', function: {...}}]
     * @param {Object} options - {temperature, maxTokens}
     * @returns {Object} {message: {role, content, tool_calls: [...]}}
     */
    async chatCompletion(messages, tools, options = {}) {
      if (!apiKey) {
        throw new Error(`${config.apiKeyEnv} is not set. Cannot call ${config.name} API.`);
      }

      const response = await axios.post(
        `${config.baseURL}/chat/completions`,
        {
          model: config.model,
          messages,
          tools: tools || undefined,
          temperature: options.temperature ?? config.defaultTemperature,
          max_tokens: options.maxTokens ?? config.defaultMaxTokens
        },
        {
          headers: {
            'Authorization': config.authHeader(apiKey),
            'Content-Type': 'application/json'
          }
        }
      );

      const choice = response.data.choices[0];
      const msg = choice.message;

      // Normalize to standard format
      return {
        message: {
          role: msg.role || 'assistant',
          content: msg.content || null,
          tool_calls: msg.tool_calls || null
        },
        finish_reason: choice.finish_reason,
        usage: response.data.usage
      };
    }
  };
}

// ── Anthropic handler (Claude) ────────────────────────────────────────

function createAnthropicProvider(config, apiKey) {
  return {
    name: config.name,
    model: config.model,

    async chatCompletion(messages, tools, options = {}) {
      if (!apiKey) {
        throw new Error(`${config.apiKeyEnv} is not set. Cannot call ${config.name} API.`);
      }

      // ── Convert OpenAI messages → Anthropic messages ──
      // Anthropic: system goes in top-level param; messages have only user/assistant roles
      let systemPrompt = '';
      const anthropicMessages = [];

      for (const msg of messages) {
        if (msg.role === 'system') {
          systemPrompt += (systemPrompt ? '\n\n' : '') + msg.content;
        } else if (msg.role === 'user') {
          anthropicMessages.push({ role: 'user', content: msg.content });
        } else if (msg.role === 'assistant') {
          anthropicMessages.push({ role: 'assistant', content: msg.content || '' });
        } else if (msg.role === 'tool') {
          // Anthropic uses user messages with tool_result blocks for tool responses
          anthropicMessages.push({
            role: 'user',
            content: [
              {
                type: 'tool_result',
                tool_use_id: msg.tool_call_id,
                content: msg.content
              }
            ]
          });
        }
      }

      // ── Convert OpenAI tools → Anthropic tools ──
      const anthropicTools = (tools || []).map(t => ({
        name: t.function.name,
        description: t.function.description,
        input_schema: {
          type: 'object',
          properties: t.function.parameters.properties || {},
          required: t.function.parameters.required || []
        }
      }));

      // ── Call Anthropic API ──
      const requestBody = {
        model: config.model,
        max_tokens: options.maxTokens ?? config.defaultMaxTokens,
        messages: anthropicMessages,
        temperature: options.temperature ?? config.defaultTemperature
      };

      if (systemPrompt) {
        requestBody.system = systemPrompt;
      }
      if (anthropicTools.length > 0) {
        requestBody.tools = anthropicTools;
      }

      const response = await axios.post(
        `${config.baseURL}/messages`,
        requestBody,
        {
          headers: {
            'x-api-key': apiKey,
            'anthropic-version': config.anthropicVersion,
            'Content-Type': 'application/json'
          }
        }
      );

      // ── Convert Anthropic response → OpenAI-compatible format ──
      const data = response.data;
      const content = data.content || [];

      // Separate text and tool_use blocks
      let textContent = '';
      const toolCalls = [];

      for (const block of content) {
        if (block.type === 'text') {
          textContent += (textContent ? '\n' : '') + block.text;
        } else if (block.type === 'tool_use') {
          toolCalls.push({
            id: block.id,
            type: 'function',
            function: {
              name: block.name,
              arguments: JSON.stringify(block.input)
            }
          });
        }
      }

      return {
        message: {
          role: 'assistant',
          content: textContent || null,
          tool_calls: toolCalls.length > 0 ? toolCalls : null
        },
        finish_reason: data.stop_reason === 'tool_use' ? 'tool_calls' : 'stop',
        usage: data.usage
      };
    }
  };
}

// ── Export ─────────────────────────────────────────────────────────────

module.exports = { createProvider, PROVIDERS };
