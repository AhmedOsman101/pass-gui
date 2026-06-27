# Configuration

The application stores its configuration in `config.toml`.

Typical locations:

- Linux: `~/.config/pass-gui/config.toml`
- macOS: `~/.config/pass-gui/config.toml`
- Windows: `%APPDATA%/pass-gui/config.toml`

When pass-gui creates this file for the first time, it writes short inline
comments describing the available options, their allowed values where
applicable, and their defaults.

## Example structure

```toml
[core] # Active application settings.
active_store = "default" # Store key used by default. Default: "default".

[preferences] # UI behavior preferences.
auto_refresh_interval_ms = 5000 # Refresh interval in ms. Default: 5000.

[generation] # Default pass generate options.
default_length = 25 # Generated password length. Default: 25.
symbols = true # Include symbols by default. Default: true.
character_set = "[:punct:][:alnum:]" # Charset when symbols are enabled. Default: "[:punct:][:alnum:]".
character_set_no_symbols = "[:alnum:]" # Charset when symbols are disabled. Default: "[:alnum:]".

[clipboard] # Clipboard behavior after copy.
clear_after_seconds = 45 # Clear clipboard after seconds. Default: 45.
selection = "clipboard" # X selection to use: clipboard, primary, secondary. Default: "clipboard".

[gpg] # Supported GPG-related pass defaults.
opts = [] # Extra GPG options passed to pass. Default: [].

[extensions] # pass extension support.
enabled = false # Enable pass extensions. Default: false.

[stores] # Configured password stores.

[stores.default] # Default store settings (default).
path = "~/.password-store" # Password store path. Default: "~/.password-store".
```

## Comment preservation

pass-gui uses `@ltd/j-toml` metadata support to preserve inline comments when
it reads and writes the config file.

What is preserved reliably:

- inline comments attached directly to key/value pairs
- inline comments attached directly to table headers
- key order and section layout tracked by the parsed TOML metadata

What is not guaranteed to be preserved:

- full-line comments that exist on their own line
- commented-out configuration keys
- arbitrary comment formatting not attached to a key or table header

## Notes

- Comments are added automatically only when pass-gui creates a brand-new
  config file.
- Existing config files are not rewritten just to inject new comments.
- Optional keys such as `gpg.signing_key`, `gpg.key`, and
  `stores.<name>.gnupg_home` may be added manually if needed.
