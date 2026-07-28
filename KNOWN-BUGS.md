# Know Bugs / Issues

- Character selection is empty right after logging in, even when the account
  has characters. The `CharSelectionInfo` the game server sends during
  `selectServer()` arrives with no characters in it; the very same packet
  parses fine when it comes from `RequestRestart` or `RequestCharacterSelection`
  (creating a character or restarting shows the full roster, and re-logging
  hides it again). So the parser is fine -- it's the first-login packet that
  comes back empty. Needs a wire-level dump of that first packet to tell
  whether the server sends it before the roster is loaded or the client reads
  it too early.
- A packet that fails to be written (e.g. `RequestAuthLogin` throwing
  "Username is too long" for a >14-char account name) is swallowed as a
  warning inside `MMOClient.process()`, so the login promise never settles and
  the UI sits on "Connecting..." forever. Failures raised while handling a
  received packet should reject the command's promise.
- MobX strict-mode warnings on every network call ("changing observable values
  without using an action ... SessionStore.isConnecting"). The stores mutate
  observables after an `await`, which puts the assignment outside the action;
  it works, but it defeats strict mode and batching. Wrap the post-await
  assignments in `runInAction`, the way `pingServers()` already does.
