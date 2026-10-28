# Completion screen: numbers, Flow switch, placement, smooth video, Time Up

## 1. Reward numbers
Remove the "0 →" starting number on every card (Marks, Completion coins, Vault reward, Vaults opened, Lives). Each card shows only the final number, which counts up in place ("9 / 9", "3", "2", "11") with the bar filling.

## 2. Flow on/off in Game Settings
A clear Flow on/off switch in the Game settings panel (next to the Flow button), plus the existing switch on the Flow page. Off = completion screen shows with no character. On = character and emotion buttons appear.

## 3. Placement exactly as arranged
- The character and the emotion buttons appear on the real completion screen at the same position and size you set on the Flow page (both saved with the game and read back by the player, scaled to the screen).
- During gameplay nobody can move or resize them; only the Flow settings page has drag/resize handles.
- Students can still press emotion buttons to change the reaction.

## 4. Smooth animation
Fix the stutter: the default (first) scene loops seamlessly without a pause/jump at the loop point, and emotions return to it without a blank or freeze. Videos are preloaded when the question starts so the completion screen plays immediately.

## 5. Each ending plays its own scene

| Situation | Screen | Scene played |
|---|---|---|
| Question finished successfully | Question Complete | Completed Successfully (Perfect / Final Victory if set) |
| Student leaves halfway (Exit/Leave) | Left the Game | Game Exited Midway |
| Time runs out, a life remains | No screen - one life is used, timer restarts, play continues | none |
| Time runs out, no lives left | **Time Up!** | Question Failed (Time Up) |

The Time Up screen has 0 stars, "Time Up!" title, rewards earned so far, and Try again / Exit.
