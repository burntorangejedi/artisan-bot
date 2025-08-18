# 🛠️ Artisan

**Artisan** is Compulsion’s custom Discord bot for managing World of Warcraft professions, recipes, and crafter coordination. Built with Node.js and Discord.js, Artisan streamlines guild crafting workflows with precision and polish.

---

## ✨ Features

- 🔍 **Crafter Search** – Find guild members by profession, skill level, or specific recipe  
- 📬 **Ping System** – Notify available crafters with cooldown-aware alerts  
- 🔄 **Admin Sync** – Sync profession data from the in-game addon to Discord  
- 📊 **Recipe Tracker** – View who can craft what, with filters and tags  
- 🧩 **Modular Roles** – Auto-assign roles based on profession or availability  

---

## 🚀 Getting Started

### Prerequisites

- Node.js v18+  
- Discord bot token  
- MongoDB or Azure Cosmos DB (optional for persistence)  

### Installation

    git clone https://github.com/yourusername/artisan  
    cd artisan  
    npm install

### Configuration

Create a `.env` file in the root directory with the following:

    DISCORD_TOKEN=your_token_here  
    GUILD_ID=your_guild_id  
    PREFIX=!

---

## 🧪 Usage

Use the following slash commands:

- /search [profession] – Find crafters by skill or recipe  
- /ping [recipe] – Notify available members with crafting capability  
- /sync – Admin-only command to update data from the WoW addon  

---

## 🧱 Architecture

    artisan/  
    ├── src/  
    │   ├── commands/       – Slash command handlers  
    │   ├── services/       – API and data sync logic  
    │   ├── utils/          – Helper functions and embed builders  
    │   ├── config/         – Role mappings and guild settings  
    │   └── index.js        – Bot entry point  
    ├── .env                – Environment variables  
    ├── package.json        – Dependencies and scripts  
    └── README.md           – You're here!

---

## 🤝 Contributing

We welcome contributions from guild members and the community.
For detailed guidelines, see [CONTRIBUTING.md](CONTRIBUTING.md).

Please submit pull requests with clear descriptions and test coverage.


---

## 📜 License

This project is licensed under the MIT License. See `LICENSE.md` for details.

---

## 🧵 Credits

Crafted with care by the Compulsion guild.  
Bot architecture by [burntorangejedi](https://github.com/burntorangejedi), with support from GitHub Copilot, our officer team, and our community testers.

---

## 💬 Support

Need help or want to suggest a feature?  
Ping `@burntorangejedi` in Discord or open an issue at [github.com/burntorangejedi/artisan-bot/issues](https://github.com/burntorangejedi/artisan-bot/issues)
