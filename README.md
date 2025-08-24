![Artisan-Bot Banner](branding/banner.png)

# 🛠️ Artisan

**Artisan** is Compulsion’s custom Discord bot for managing World of Warcraft professions, recipes, and crafter coordination. Built with Node.js and Discord.js, Artisan streamlines guild crafting workflows with precision and polish.

---

## 🚀 Quickstart: Setting Up Artisan for Your Guild

**If you’re starting fresh (e.g., initial install, or after deleting the database), follow these steps:**

1. **Delete the old database file**  
   Remove your SQLite database file (e.g., `guilddata.sqlite`) from the project directory. This step is optional and only needed for a full reset.

2. **Restart the bot**  
   This will recreate the database tables automatically.

3. **Create all Discord roles**  
   Run the following command in your Discord server (admin only):  
   ```
   /guild-roles add
   ```
   This will create all class/spec, main role, and profession roles with appropriate colors.

4. **Sync the guild roster and professions**  
   Run:  
   ```
   /sync-guild
   ```
   This fetches the latest roster and profession/spec data from Blizzard and populates the database.

5. **Have members claim their characters**  
   Each guild member should run:  
   ```
   /characters claim <character name>
   ```
   This links their Discord account to their character(s) and automatically assigns the correct class/spec, main role, and profession roles.

   Members can also:
   - List their claimed characters: `/characters list`
   - Set a main character: `/characters setmain <character name>`
   - Unclaim a character: `/characters unclaim <character name>`

---


## 🛠️ Features

- **Automatic role assignment** for class/spec, main role (Tank/Healer/DPS), and professions when a character is claimed
- **Profession and recipe search** with `/whohas` (supports pagination with Next/Previous buttons)
- **Easy guild roster and profession syncing** with `/sync-guild`
- **Admin commands** for bulk role management (`/guild-roles add`/`remove`)
- **Character claiming and management** with `/characters` commands
- **/help command** for in-Discord command reference
## ⚙️ Environment Variables

You can configure the bot using a `.env` file in the project root. Key variables:

- `DEBUG_LEVEL` — Set to `info`, `verbose`, or `error` for logging detail
- `SYNC_BATCH_SIZE` — Number of characters to process in parallel during sync (default: 5)
- `WHO_HAS_PAGE_SIZE` — Number of results per page for `/whohas` (default: 10)
- `WHOHAS_OUTPUT_STYLE` — Set to `table` (default) or `embed` for `/whohas` output style
- `DISCORD_LIMIT` — Max message length for table output (default: 100)
## 🆘 Commands Overview

**/help** — Show a summary of all commands and features

**/sync-guild** — Admin: Sync or refresh guild data from Blizzard API (updates roster, professions, and recipes)

**/whohas <item/recipe>** — Find out who can craft a specific recipe or item (supports pagination with Next/Previous buttons)

**/characters** — Manage your claimed characters:
   • `/characters claim <character>` — Claim a character as your own
   • `/characters setmain <character>` — Set one of your claimed characters as your main
   • `/characters list` — List all characters you have claimed (shows class, spec, main role, and main status)
   • `/characters unclaim <character>` — Unclaim a character you previously claimed

**/guild-roles add** — Admin: Create all class/spec, main, and profession roles
**/guild-roles remove** — Admin: Remove all class/spec, main, and profession roles

---

---

## 🤝 Contributing

We welcome contributions!  
See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

---

## 💬 Support

Need help or want to suggest a feature?  
Ping **@burntorangejedi** in Discord or open an issue at [github.com/burntorangejedi/artisan-bot/issues](https://github.com/burntorangejedi/artisan-bot/issues)

---

**Enjoy!**