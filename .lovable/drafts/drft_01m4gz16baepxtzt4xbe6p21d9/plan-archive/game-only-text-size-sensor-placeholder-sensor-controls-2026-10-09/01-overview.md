# Game only: text size, sensor placeholder, sensor controls

Scope: the Game player and Game editor settings only. Smartboard and Academia stay unchanged.

## 1. Text size
- When a player enters, they see exactly the size the creator saved for that device (Desktop, Tablet or Phone). For example, 20% stays 20%.
- The player's size slider uses the same minimum, maximum and steps as the creator's slider and starts at the saved value.
- The extra multiplier on top of the saved size is removed. The player's slider sets the real size directly.

## 2. Sensor and placeholders
- Writing Surface 0 (the question) never takes the sensor.
- On every other surface the sensor stays visible. When a new empty slot appears (for example a bracket, exponent or fraction cell), the sensor moves into it automatically. It only does this after the slot exists, never before.
- The player can step back out of a slot. Later slots further down the surface can also be entered.
