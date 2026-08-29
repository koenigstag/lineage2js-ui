# Know Bugs / Issues

If you find missing feature please check [TODO.md](./TODO.md) first. If it is not listed there, please [open an issue](https://github.com/koenigstag/lineage2js-ui/issues).

## List of known bugs / issues
- Not all items/skills/actions have icons but should have translation. Some have just placeholder background, some have missing icons. This is because of copyrighted icons. Please see [README.md](README.md) for instructions on how to serve your own game icons.
- The Learn tab does not show the skills available at the level you are on (tested at level 1); it lists ones needing level 30+.
- Chat commands (`/target`, `/invite`, ...) are not implemented -- a line starting with `/` is sent as ordinary chat on the active tab's channel.
- Double-clicking a ring or earring you are not wearing takes off the one you are, instead of putting the clicked one in the free slot. Where to start looking is in [TODO.md](./TODO.md).
- A Kamael's wing stays where it is while the body leans into a run, instead of following the back. What is known and what to try next is in [TODO.md](./TODO.md).
