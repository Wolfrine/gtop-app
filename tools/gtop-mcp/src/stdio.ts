#!/usr/bin/env node
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createMcpServer } from "./index.js";
await createMcpServer().connect(new StdioServerTransport());
