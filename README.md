# 🛠️ Artisan

**Artisan** is Compulsion’s custom Discord bot for managing World of Warcraft professions, recipes, and crafter coordination. Built with Node.js and Discord.js, Artisan streamlines guild crafting workflows with precision and polish.

---

## 🚀 Quickstart: Setting Up Artisan for Your Guild

**If you’re starting fresh (e.g., initial install, or after deleting the database), follow these steps:**

1. **Delete the old database file**  
   Remove your SQLite database file (e.g., `guilddata.sqlite`) from the project directory. This step is (obviously) optional as it does a full purge of all the data used by the bot. Recommended if things get completely out of sync, and then register an issue with me here on GitHub. 

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
   /syncguild
   ```
   This fetches the latest roster and profession/spec data from Blizzard and populates the database.

5. **Have members claim their characters**  
   Each guild member should run:  
   ```
   /claim character <character name>
   ```
   This links their Discord account to their character(s) and automatically assigns the correct class/spec, main role, and profession roles.

   Optionally, the bot support providing multiple character names with the command, but intellisense / autocomplete is not available for any but the first character. e.g.
   ```
   /claim character Toon1 Toon2 Toon3
   ```
      Might not even want to mention it to your guildies, but I included it here because I was too lazy to type the command over and over again for my own characters.

6. **(Optional) List claimed characters**  
   Members can see their claimed characters with:  
   ```
   /claim list
   ```

7. **(Optional) Remove all roles created by the bot**  
   If you need to clean up, run:  
   ```
   /guild-roles remove
   ```

---

## 🧩 Features

- **Automatic role assignment** for class/spec, main role (Tank/Healer/DPS), and professions when a character is claimed
- **Profession and recipe search** with `/whohas`
- **Easy guild roster and profession syncing** with `/syncguild`
- **Admin commands** for bulk role management

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