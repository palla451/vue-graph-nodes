<template>
  <div class="graph-container">
    <!-- Definizione gradienti per nodi -->
    <svg width="0" height="0">
      <defs>
        <radialGradient id="nodeGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stop-color="#00ffcc" stop-opacity="1" />
          <stop offset="100%" stop-color="#003333" stop-opacity="0" />
        </radialGradient>
        <radialGradient id="nodeSelectedGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stop-color="#00ffff" stop-opacity="1" />
          <stop offset="100%" stop-color="#001111" stop-opacity="0" />
        </radialGradient>
      </defs>
    </svg>

    <!-- Grafo -->
    <v-network-graph
      ref="graphRef"
      :nodes="nodes"
      :edges="edges"
      :layouts="layouts"
      :configs="configs"
    />

    <!-- Messaggio server -->
    <div v-if="serverMessage" class="server-message">
      {{ serverMessage }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import * as vNG from 'v-network-graph'
import 'v-network-graph/lib/style.css'

const graphRef = ref(null)
const nodes = ref({})
const edges = ref({})
const layouts = ref({ nodes: {} })
const serverMessage = ref('')

const configs = reactive(
  vNG.defineConfigs({
    view: {
      autoPanAndZoomOnLoad: 'center-content',
      zoomInitial: 1,
      zoomMax: 10,
      zoomMin: 0.1,
      panEnabled: true,
      zoomEnabled: true,
    },
    node: {
      selectable: true,
      normal: {
        type: 'circle',
        radius: 18,
        strokeWidth: 0,
        strokeColor: '#00ffff',
        color: 'url(#nodeGlow)',
      },
      hover: {
        radius: 20,
        strokeWidth: 2,
        strokeColor: '#00ffcc',
        color: '#0ff',
      },
      selected: {
        radius: 24,
        strokeWidth: 5,
        strokeColor: '#00ffcc',
        color: 'url(#nodeSelectedGlow)',
      },
      label: {
        visible: true,
        fontFamily: 'monospace',
        fontSize: 12,
        color: '#ffffffcc',
        margin: 6,
        direction: 'south',
        background: {
          visible: true,
          color: '#1e1e1ecc',
          padding: { vertical: 2, horizontal: 6 },
          borderRadius: 6,
        },
      },
      focusring: {
        visible: true,
        width: 4,
        padding: 4,
        color: '#00ffc3',
        dasharray: '2,2',
      },
    },
    edge: {
      selectable: true,
      normal: {
        width: 1.5,
        color: '#00bcd4',
        animate: true,
        animationSpeed: 50,
      },
      hover: {
        width: 3,
        color: '#00ffe3',
        animate: true,
      },
      selected: {
        width: 3,
        color: '#ff4081',
        dasharray: '6',
        animate: true,
      },
      gap: 2,
      type: 'straight',
    },
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
                    gt: '2025-05-08T22:00:00.000Z',
                    lt: '2025-05-19T21:59:59.999Z'
                  }
                }
              },
              {
                query_string: {
                  query: 'source.domain:* OR destination.domain:*'
                }
              }
            ],
            filter: [
              {
                match: {
                  'observer.product.keyword': 'tca_node'
                }
              }
            ],
            must_not: [
              {
                match: {
                  'event.kind.keyword': 'alert'
                }
              }
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
    const spacingX = 160
    const spacingY = 110

    for (const [i, node] of limitedNodes.entries()) {
      const col = i % nodesPerRow
      const row = Math.floor(i / nodesPerRow)

      rawPositions.push({
        id: node.ip,
        label: node.hostname ?? node.ip, // hostname se esiste, altrimenti IP
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
      nodes.value[pos.id] = { name: pos.label }
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
      graphRef.value?.graph?.zoomFit?.()
    }, 300)
  } catch (error) {
    console.error('Errore nella fetch:', error)
    serverMessage.value = '❌ Errore nella richiesta al server.'
  }
})
</script>

<style>
body {
  margin: 0;
  background-color: #111827;
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
}

.graph-container {
  width: 100vw;
  height: 100vh;
  background-color: #111827;
  overflow: hidden;
  display: flex;
  justify-content: center;
  align-items: center;
  position: relative;
}

.server-message {
  position: fixed;
  bottom: 24px;
  left: 50%;
  transform: translateX(-50%);
  background-color: #1f2937;
  color: #facc15;
  border: 1px solid #fde68a;
  padding: 12px 24px;
  border-radius: 10px;
  font-weight: 500;
  font-size: 14px;
  box-shadow: 0 0 10px #facc15aa;
  z-index: 999;
  opacity: 0;
  animation: fadeIn 0.6s ease-in-out forwards;
}

@keyframes fadeIn {
  to {
    opacity: 1;
  }
}
</style>
