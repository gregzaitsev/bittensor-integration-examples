// Input is a signed SCALE extrinsic. Keys never go to the node.
export async function submitAndWait(api, signedHex) {
  const tx = api.tx(signedHex);
  if (!tx.isSigned) throw new Error('The transaction must be signed.');

  let unsubscribe;
  let timer;
  let finished = false;
  try {
    return await new Promise((resolve, reject) => {
      // A timeout is not proof of failure. Check the hash before retrying.
      timer = setTimeout(() => reject(new Error(`Status unknown: timeout for ${tx.hash.toHex()}`)), 180_000);
      api.rpc.author.submitAndWatchExtrinsic(signedHex, async (status) => {
        console.error(`Status: ${status.type}`);
        if (status.isInvalid || status.isDropped || status.isUsurped || status.isFinalityTimeout) {
          reject(new Error(`Status unknown or rejected: ${status.type}; hash ${tx.hash.toHex()}`));
        }
        if (!status.isFinalized) return;
        try {
          const blockHash = status.asFinalized;
          const { block } = await api.rpc.chain.getBlock(blockHash);
          const index = block.extrinsics.findIndex((ex) => ex.hash.eq(tx.hash));
          if (index < 0) throw new Error('Transaction missing from finalized block.');
          const at = await api.at(blockHash);
          const events = (await at.query.system.events()).filter(({ phase }) =>
            phase.isApplyExtrinsic && phase.asApplyExtrinsic.eq(index));
          const failure = events.find(({ event }) => api.events.system.ExtrinsicFailed.is(event));
          if (failure) throw new Error(`Finalized but failed: ${failure.event.data[0]}`);
          if (!events.some(({ event }) => api.events.system.ExtrinsicSuccess.is(event))) {
            throw new Error('No execution result.');
          }
          resolve({ hash: tx.hash.toHex(), blockHash: blockHash.toHex(), height: block.header.number.toString(), index });
        } catch (error) {
          reject(error);
        }
      }).then((stop) => {
        // If a timeout happened first, close the late subscription too.
        if (finished) stop();
        else unsubscribe = stop;
      }, reject);
    });
  } finally {
    finished = true;
    clearTimeout(timer);
    unsubscribe?.();
  }
}
