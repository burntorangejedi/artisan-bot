# 🤝 Contributing to Artisan

Thanks for your interest in contributing to **Artisan**, Compulsion’s custom Discord bot for profession and recipe management in World of Warcraft. Whether you're fixing a bug, improving UX, or adding a new feature, we appreciate your support!

---

## 🧭 Guild Culture First

Artisan is built for clarity, inclusivity, and officer-proof workflows. Contributions should reflect Compulsion’s values:

- 🛡️ **Safety & Transparency** – Clear logic, no hidden behavior  
- 🎯 **Usability** – Designed for non-technical officers and members  
- 🧵 **Consistency** – Match existing embed style, color palette, and naming conventions  
- 🧠 **Scalability** – Modular code that adapts to future guild needs  

---

## 🛠️ How to Contribute

### 1. Fork the Repository

Create your own fork of the project and clone it locally:
```
    git clone https://github.com/burntorangejedi/artisan
```
### 2. Create a Branch

Use a descriptive branch name:
```
    git checkout -b fix/crafter-search-filter  
    git checkout -b feature/recipe-tagging
```
### 3. Make Your Changes

Follow the existing code structure and comment style. If you're adding a command, place it in `src/commands/`. If you're updating embed logic, use `src/utils/embedBuilder.js`.

### 4. Test Thoroughly

Use a test guild or sandbox channel to verify your changes.  
Make sure slash commands register correctly and embeds render as expected.

### 5. Submit a Pull Request

Push your branch and open a PR with:

- A clear title and description  
- Screenshots or examples if UI is affected  
- Notes on any new config or `.env` variables  

Open your pull request here:  
[https://github.com/burntorangejedi/artisan/pulls](https://github.com/burntorangejedi/artisan/pulls)

---

## 🧪 Code Style & Standards

- Use ES6+ syntax  
- Prefer async/await over callbacks  
- Keep functions small and focused  
- Use descriptive variable and function names  
- Avoid hardcoding role IDs or guild-specific values — use config files

---

## 🧩 Feature Ideas

Looking for ways to contribute? Here are some open ideas:

- Add support for alt characters and profession sync  
- Create a `/whohas [item_id]` command for recipe lookup  
- Improve embed styling for mobile readability  
- Add cooldown tracking for daily crafts

---

## 🧵 Need Help?

Ping <@512839235921772544> in Discord or open a discussion in GitHub Issues:  
[https://github.com/burntorangejedi/artisan/issues](https://github.com/burntorangejedi/artisan/issues)

We’re happy to pair-program, review your PR, or help you get started.

---

Thanks again for helping make Artisan better for the Compulsion guild, and anyone else who wants to use it!

