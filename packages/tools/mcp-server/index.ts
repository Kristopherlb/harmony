/**
 * @golden/mcp-server
 * Phase 4: Tool manifest + MCP server.
 */
export {
  generateToolManifestFromCapabilities,
  type ToolManifest,
  type ToolManifestEntry,
} from './src/manifest/capabilities.js';

export {
  createToolSurface,
  type ToolSurface,
  type McpTool,
  type McpToolCallParams,
  type McpToolResult,
} from './src/mcp/tool-surface.js';

export {
  createMcpJsonRpcHandler,
  type JsonRpcRequest,
  type JsonRpcResponse,
} from './src/mcp/jsonrpc-handler.js';

export { runMcpStdioServer, type StdioServerOptions } from './src/mcp/stdio-server.js';

