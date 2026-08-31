import { WebWorkerMLCEngineHandler } from '@mlc-ai/web-llm'

// Hook up WebWorkerMLCEngineHandler to handle WebGPU inference requests in the background
const handler = new WebWorkerMLCEngineHandler()

self.onmessage = (msg: MessageEvent) => {
  handler.onmessage(msg)
}
