// File exchange between the two containers (documented Gladys pattern):
// the sub-container "wu-receiver" declares the volume "/shared" in the
// manifest; the main container sees the same folder under
// /data/containers/wu-receiver/shared. Sub-containers get no Gladys
// credentials (GLADYS_* env keys are reserved), so the receiver only writes
// the latest readings there and the main container publishes them.

export const RECEIVER_NAME = "wu-receiver";
export const RECEIVER_SHARED_DIR = "/shared"; // as seen by the receiver
export const MAIN_SHARED_DIR = `/data/containers/${RECEIVER_NAME}/shared`; // as seen by the main container
export const LATEST_FILE = "latest.json";
