export type NodeInfo = {
  id: string;
  name: string;
  what: string;
  contract: string;
  builtHere: string;
};

export const NODE_INFO: Record<string, NodeInfo> = {
  "producer-a": {
    id: "producer-a",
    name: "Producer A",
    what: "Represents equipment emitting events over a SMEMA handshake — one board, one event.",
    contract: "SMEMA handshake",
    builtHere:
      "I didn't build the equipment. This models the machine side of the interface my adapter consumes.",
  },
  "producer-b": {
    id: "producer-b",
    name: "Producer B",
    what: "Represents equipment emitting events over a second vendor's proprietary protocol.",
    contract: "Vendor protocol B",
    builtHere:
      "I didn't build the equipment. This models the machine side of the interface my adapter consumes.",
  },
  "producer-c": {
    id: "producer-c",
    name: "Producer C",
    what: "Represents equipment emitting events over a third vendor's proprietary protocol.",
    contract: "Vendor protocol C",
    builtHere:
      "I didn't build the equipment. This models the machine side of the interface my adapter consumes.",
  },
  "queue-a": {
    id: "queue-a",
    name: "Queue A",
    what: "Holds events between the equipment side and the adapter that processes them, so a slow or offline consumer doesn't lose them.",
    contract: "RabbitMQ, durable queue",
    builtHere:
      "I designed which events land in which queue and how backpressure surfaces. The durability itself is RabbitMQ's, not something I wrote.",
  },
  "queue-b": {
    id: "queue-b",
    name: "Queue B",
    what: "Holds events between the equipment side and the adapter that processes them, so a slow or offline consumer doesn't lose them.",
    contract: "RabbitMQ, durable queue",
    builtHere:
      "I designed which events land in which queue and how backpressure surfaces. The durability itself is RabbitMQ's, not something I wrote.",
  },
  "queue-c": {
    id: "queue-c",
    name: "Queue C",
    what: "Holds events between the equipment side and the adapter that processes them, so a slow or offline consumer doesn't lose them.",
    contract: "RabbitMQ, durable queue",
    builtHere:
      "I designed which events land in which queue and how backpressure surfaces. The durability itself is RabbitMQ's, not something I wrote.",
  },
  "adapter-a": {
    id: "adapter-a",
    name: "Adapter A",
    what: "Translates the SMEMA handshake into a common event shape, and can withhold the ready signal to hold a board in place.",
    contract: "SMEMA → IPC-CFX",
    builtHere:
      "I built the adapter, the TCP reconnect and heartbeat logic, and the board-eligibility validation that withholds the ready signal.",
  },
  "adapter-b": {
    id: "adapter-b",
    name: "Adapter B",
    what: "Translates vendor protocol B into a common event shape before it reaches the normalizer.",
    contract: "Vendor protocol B → IPC-CFX",
    builtHere:
      "I built the adapter and its TCP reconnect and heartbeat logic.",
  },
  "adapter-c": {
    id: "adapter-c",
    name: "Adapter C",
    what: "Translates vendor protocol C into a common event shape before it reaches the normalizer.",
    contract: "Vendor protocol C → IPC-CFX",
    builtHere:
      "I built the adapter and its TCP reconnect and heartbeat logic.",
  },
  normalizer: {
    id: "normalizer",
    name: "Normalizer",
    what: "Maps every adapter's output into one unified event schema, and isolates malformed events instead of letting them crash the pipeline.",
    contract: "IPC-CFX",
    builtHere:
      "I built the normalization and the bounded-retry, dead-letter routing for malformed events.",
  },
  sink: {
    id: "sink",
    name: "Sink",
    what: "Terminal event store — every successfully processed event lands here.",
    contract: "Azure",
    builtHere: "I built the services that write here. Azure provides the storage.",
  },
  dlq: {
    id: "dlq",
    name: "Dead-letter queue",
    what: "Holds events that failed normalization after a bounded number of retries, instead of dropping them silently.",
    contract: "RabbitMQ, dead-letter queue",
    builtHere: "I built the bounded retry and dead-letter routing that feeds this queue.",
  },
};
