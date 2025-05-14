<template>
  <div class="graph-container">
    <v-network-graph
        ref="graphRef"
        :nodes="nodes"
        :edges="edges"
        :layouts="layouts"
        :configs="configs"
    />
    <div v-if="serverMessage" class="server-message">
      {{ serverMessage }}
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { defineConfigs } from 'v-network-graph'
import 'v-network-graph/lib/style.css'

const graphRef = ref(null)
const nodes = ref({})
const edges = ref({})
const layouts = ref({ nodes: {} })

const serverMessage = ref('') // 👈 messaggio del server

const configs = reactive(
    defineConfigs({
      view: {
        autoPanAndZoomOnLoad: 'center-content',
        zoomInitial: 1,
        zoomMax: 10,
        zoomMin: 0.1,
        panEnabled: true,
        zoomEnabled: true
      },
      node: {
        label: {
          visible: true
        }
      }
    })
)

onMounted(async () => {
  try {
    const response = await fetch('http://mcc-be.local/api/auth/network_graph', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: {
          bool: {
            must: [
              {
                range: {
                  '@timestamp': {
                    gt: '2025-05-01T22:00:00.000Z',
                    lt: '2025-05-12T21:59:59.999Z'
                  }
                }
              }
            ],
            filter: [
              { match: { 'observer.product.keyword': 'tca_node' } }
            ],
            must_not: [
              { match: { 'event.kind.keyword': 'alert' } }
            ]
          }
        }
      })
    })

    const result = await response.json()

    if (result.message) {
      serverMessage.value = `⚠️ ${result.message}`
    }

    const maxNodes = 100
    const limitedNodes = (result.nodes || []).slice(0, maxNodes)

    const rawPositions = []
    const nodesPerRow = 10
    const spacingX = 180
    const spacingY = 120

    for (const [i, node] of limitedNodes.entries()) {
      const col = i % nodesPerRow
      const row = Math.floor(i / nodesPerRow)

      rawPositions.push({
        id: node.ip,
        name: node.ip,
        x: col * spacingX,
        y: row * spacingY
      })
    }

    const minX = Math.min(...rawPositions.map(p => p.x))
    const maxX = Math.max(...rawPositions.map(p => p.x))
    const minY = Math.min(...rawPositions.map(p => p.y))
    const maxY = Math.max(...rawPositions.map(p => p.y))
    const centerX = (minX + maxX) / 2
    const centerY = (minY + maxY) / 2

    nodes.value = {}
    layouts.value.nodes = {}

    for (const pos of rawPositions) {
      nodes.value[pos.id] = { name: pos.name }
      layouts.value.nodes[pos.id] = {
        x: pos.x - centerX,
        y: pos.y - centerY
      }
    }

    edges.value = {}
    for (const [i, edge] of (result.edges || []).entries()) {
      if (nodes.value[edge.source_ip] && nodes.value[edge.destination_ip]) {
        edges.value[`edge-${i}`] = {
          source: edge.source_ip,
          target: edge.destination_ip
        }
      }
    }

    setTimeout(() => {
      if (graphRef.value?.graph?.zoomFit) {
        graphRef.value.graph.zoomFit()
      }
    }, 300)

  } catch (error) {
    console.error('Errore nella fetch:', error)
    serverMessage.value = '❌ Errore nella richiesta al server.'
  }
})
</script>

<style>
.graph-container {
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  background-color: white;
  position: relative;
}

.server-message {
  position: fixed;
  bottom: 10px;
  left: 50%;
  transform: translateX(-50%);
  background-color: #f8d7da;
  color: #721c24;
  border: 1px solid #f5c6cb;
  padding: 10px 20px;
  border-radius: 8px;
  font-weight: bold;
  box-shadow: 0 2px 6px rgba(0,0,0,0.2);
  z-index: 1000;
}
</style>
