// Publishes only the values that changed since the previous publication
// (Gladys limits state updates to 300/min per integration).
export function createChangePublisher({ ids, publishStates }) {
  const last = new Map();
  return {
    async publish(readings) {
      const states = [];
      for (const [key, value] of Object.entries(readings)) {
        const id = ids.feature(key);
        if (last.get(id) === value) continue;
        states.push({ device_feature_external_id: id, state: value });
      }
      if (states.length === 0) return 0;
      await publishStates(states);
      for (const s of states) last.set(s.device_feature_external_id, s.state); // remember only after success
      return states.length;
    },
  };
}
