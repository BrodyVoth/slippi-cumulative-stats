const glob = require("glob")
const { default: SlippiGame } = require('@slippi/slippi-js')
const readlineSync = require('readline-sync')
const fs = require('fs');
const path = require('path')
const pjson = require('./package.json')
const jsonLock = require('./package-lock.json')
const crypto = require('crypto')

const statsVersion = pjson.version
const slippiJsVersion = jsonLock.dependencies["@slippi/slippi-js"].version
const cacheFilePath = "./replayCache.json"

// Characters ordered by ID
const characters = ['Captain Falcon', 'Donkey Kong', 'Fox', 'Mr. Game & Watch', 'Kirby', 'Bowser',
            'Link', 'Luigi', 'Mario', 'Marth', 'Mewtwo', 'Ness', 'Peach', 'Pikachu',
            'Ice Climbers', 'Jigglypuff', 'Samus', 'Yoshi', 'Zelda', 'Sheik', 'Falco',
            'Young Link', 'Dr. Mario', 'Roy', 'Pichu', 'Ganondorf', 'Master Hand', 'Male Wireframe',
            'Female Wireframe', 'Giga Bowser', 'Crazy Hand', 'Sandbag', 'Popo', 'Unknown']

const characters_lowercase = ['captain falcon', 'donkey kong', 'fox', 'mr. game & watch', 'kirby', 'bowser',
            'link', 'luigi', 'mario', 'marth', 'mewtwo', 'ness', 'peach', 'pikachu',
            'ice climbers', 'jigglypuff', 'samus', 'yoshi', 'zelda', 'sheik', 'falco',
            'young link', 'dr. mario', 'roy', 'pichu', 'ganondorf', 'master hand', 'male wireframe',
            'female wireframe', 'giga bowser', 'crazy hand', 'sandbag', 'popo', 'Unknown']            

// Stages ordered by ID
const stages = [null, null, 'Fountain of Dreams', 'Pokémon Stadium', "Princess Peach's Castle", 'Kongo Jungle',
                'Brinstar', 'Corneria', "Yoshi's Story", 'Onett', 'Mute City', 'Rainbow Cruise', 'Jungle Japes',
                'Great Bay', 'Hyrule Temple', 'Brinstar Depths', "Yoshi's Island", 'Green Greens', 'Fourside', 
                'Mushroom Kingdom I', 'Mushroom Kingdom II', null, 'Venom', 'Poké Floats', 'Big Blue', 'Icicle Mountain',
                'Icetop', 'Flat Zone', 'Dream Land N64', "Yoshi's Island N64", 'Kongo Jungle N64', 'Battlefield', 'Final Destination']

console.log(`| \x1b[92mSlippi Cumulative Stats\x1b[0m v${statsVersion}`)
console.log('-------------------------------')
console.log("| Script checks current folder and subfolders. Provide optional info if you want more specific stats")
console.log('| Note: Replays with no player data (pre-July 2020) are skipped (but counted in overall playtime)')
console.log('| Note: Your answers are not case-sensitive')
console.log('| NEW: Search for multiple connect codes or nicknames by separating them with a comma')
console.log('-------------------------------')
const cache = loadCache()
console.log('-------------------------------')

if (!!cache.user_player_arg) {
    user_player_arg = readlineSync.question(`Enter your connect code(s) or nickname(s) (Leave blank for ${cache.user_player_arg}): `, {defaultInput: cache.user_player_arg})
    user_player = user_player_arg.toLowerCase().split(",")

}
else {
    user_player_arg = readlineSync.question('Enter your connect code(s) or nickname(s) (Will be stored for next use): ')
    user_player = user_player_arg.toLowerCase().split(",")
}
if (!user_player) {
    readlineSync.question(`You must enter a connect code (ex. ZIMP#721) or a nickname. Connect codes are preferred.`)
    process.exit()
}

const opponent_arg = readlineSync.question("Enter your opponent's code(s) or nickname(s) (Optional. Leave blank for all opponents): ") || false
const player_character_arg = readlineSync.question('Enter your character (Optional. Leave blank for all your characters): ') || false

if (player_character_arg) {
    player_character_requested = checkCharacter(player_character_arg)
}

const character_arg = readlineSync.question("Enter your opponent's character (Optional. Leave blank for all characters): ") || false

if (character_arg) {
    character_requested = checkCharacter(character_arg)
}

function loadCache() {
    try {
        const contents = fs.readFileSync(cacheFilePath, 'utf8')
        const data = JSON.parse(contents)
        if (!data) {
            console.log('| No replays cache found so all replays will be scanned. Future scans will be much faster.')
            return {results: {}}
        }
        // Don't have to worry about this yet I think. Best to not assume anything is broken until it is and try to work around it then
        // if (data.statsVersion != statsVersion) { return {} }
        // if (data.slippiJsVersion != slippiJsVersion) { return {} }
        console.log('| ' + Object.keys(data.results).length + ' replays have been cached previously. Any new replays will be fully scanned and cached.')
        return data
    } catch {
        console.log('| No replay cache found so all replays will be scanned. Future scans will be much faster.')
        return {results: {}}
    }
}

function checkCharacter(character_param) {
    user_character = character_param.toLowerCase()
    if (!characters_lowercase.includes(user_character)) {
        console.log(`${user_character} is not a valid character.`)
        readlineSync.question(`Valid characters: ${characters_lowercase.slice(0,26).sort().join(', ')}`)
        process.exit()
    }
    else {
        return user_character
    }
}

const ignored_arg = readlineSync.question("Enter any opponent's codes/names to skip (Optional): ")

if (opponent_arg) {
    opponent_player = opponent_arg.toLowerCase().trim().split(",")
}

if (ignored_arg) {
    ignored_list = ignored_arg.toLowerCase().split(",")
}

const files = glob.sync("**/*.slp");

if (files.length == 0) {
    readlineSync.question("No replays found. Script should be ran in the same folder or a parent folder of the replays.")
    process.exit()
}

var total_games = 0
var total_wins = 0
var total_seconds = 0
var counted_seconds = 0
var character_totals = []
var character_wins = [] 
var character_head_to_head = Array(34).fill().map(() => Array(34).fill().map((e, i) => [0, 0, characters[i]]));
var character_playtime = []
var nickname_totals = []
var nickname_wins = []
var nickname_playtime = []
var code_totals = []
var code_wins = []
var code_playtime = []
var opponent_totals = []
var opponent_wins = []
var opponent_playtime = []
var stage_totals = []
var stage_wins = []
var stage_playtime = []
var final_player_name = user_player
var new_replays = 0

console.log(`${files.length} replays found.`)

files.forEach((file, i) => {
    const gameData = loadGameData(file, i)
    if (!gameData) { return }
    cache.results[gameData.hash] = gameData
    const results = processGame(file, i, gameData)
    processResults(results)
})

fs.writeFileSync(cacheFilePath, JSON.stringify({
    statsVersion,
    slippiJsVersion,
    user_player_arg,
    results: cache.results
}))

printResults()

function loadGameData(file, i) {
    filename = path.basename(file)
    const hash = crypto.createHash('md5').update(filename).digest("hex")
    if (!!cache && !!cache.results[hash]) {
        return cache.results[hash]
    }
    let data = { hash }
    try {
        const game = new SlippiGame(file)
        data.settings = game.getSettings()
        data.metadata = game.getMetadata()
        // skips pre-July replays that have no player data
        if (JSON.stringify(data.metadata.players[0].names) === '{}' || JSON.stringify(data.metadata.players[1].names) === '{}') {
            new_replays += 1
            return data
        }
        // earlier doubles check
        if (data.settings.players.length > 2) {
            new_replays += 1
            return data
        }
        data.stats = game.getStats().overall.map((o) => o.killCount)
        data.latestFramePercents = game.getLatestFrame().players.map((p) => p.post.percent)
        new_replays += 1
        return data
    } catch {
        console.log(`${i+1}: Error reading metadata. Ignoring... (${file})`)
        return
    }
}

function processGame(file, i, gameData) {
    const { settings, metadata, stats, latestFramePercents } = gameData
    let data = {}
    num = i+1
    try {
        try {
            game_seconds = Math.floor(metadata.lastFrame / 60)
            game_length = Math.floor(game_seconds / 60) + ":" + (game_seconds % 60 ? (game_seconds % 60).toString().padStart(2, '0') : '00')
            data.total_seconds = game_seconds
        }
        catch(err) {
            console.log(`${num}: Error reading metadata. Ignoring... (${file})`)
            return data
        }
        if (settings.players.length !== 2) {
            console.log(`${num}: More than 2 players. Ignoring... (${file})`)
            return data
        }
        try {
            if (JSON.stringify(metadata.players[0].names) === '{}' || JSON.stringify(metadata.players[1].names) === '{}') {
                console.log(`${num}: Old or offline. Ignoring... (${file})`)
                return data
            }
        }
        catch(err) {
            console.log(`${num}: Missing player info. Ignoring... (${file})`)
            return data
        }

        player_num = 'none'
        opponent_num = 'none'
        opponent_found = false
        ignored_opponent_found = false
        player_names = [metadata.players[0].names.netplay, metadata.players[1].names.netplay]
        player_codes = [metadata.players[0].names.code, metadata.players[1].names.code]
        player_characters = [settings.players[0].characterId, settings.players[1].characterId]


        for (j = 0; j < settings.players.length; j++) {
            if (opponent_arg) {
                for (k of opponent_player) {
                    opponent = k.trim()
                    if (player_names[j].toLowerCase().trim() == opponent || player_codes[j].toLowerCase() == opponent) {
                        opponent_found = true
                    }
                }
            }
            if (ignored_arg) {
                for (k of ignored_list) {
                    skipped_opponent = k.trim()
                    if (player_names[j].toLowerCase().trim() == skipped_opponent || player_codes[j].toLowerCase() == skipped_opponent) {
                        ignored_opponent_found = true
                        found_ignored_opponent = `${player_names[j]} (${player_codes[j]})`
                    }
                }
            }
            for (k of user_player) {
                if (player_names[j].toLowerCase().trim() == k || player_codes[j].toLowerCase() == k) {
                    player_num = j
                    if (player_num == 0) {
                        opponent_num = 1
                    }
                    else {
                        opponent_num = 0
                    }
                    break
                }
            }
        }
        if (player_num == 'none') {
            console.log(`${num}: User(s) ${user_player} missing. Ignoring... (${file})`)
            return data
        }
        if (opponent_arg && !opponent_found) {
            console.log(`${num}: Opponent(s) ${opponent_player} missing. Ignoring... (${file})`)
            return data
        }
        if (ignored_arg && ignored_opponent_found) {
            console.log(`${num}: ${found_ignored_opponent} found. Ignoring... (${file})`)
            return data
        }

        player_character_num = player_characters[player_num]
        player_character = characters[player_character_num]
        player_name = player_names[player_num]

        opponent_character_num = player_characters[opponent_num]
        opponent_character = characters[opponent_character_num]
        opponent_name = player_names[opponent_num]
        opponent_code = player_codes[opponent_num]

        stage_num = settings.stageId

        if (player_character_arg && player_character.toLowerCase() !== player_character_requested) {
            requested_player_character_num = characters_lowercase.indexOf(player_character_requested)
            console.log(`${num}: ${player_name} playing ${player_character}. Ignoring... (${file})`)
            return data
        }

        if (character_arg && opponent_character.toLowerCase() !== character_requested) {
            requested_character_num = characters_lowercase.indexOf(character_requested)
            console.log(`${num}: ${opponent_name} playing ${opponent_character}. Ignoring... (${file})`)
            return data
        }

        player_kills = stats[player_num]
        opponent_kills = stats[opponent_num]

        // Tie conditions
        if (game_seconds < 30) {
            console.log(`${num}: Match under 30 seconds. Ignoring... (${file})`)
            return data
        }
        if (player_kills == 0 && opponent_kills == 0) {
            console.log(`${num}: No stocks were taken. Ignoring... (${file})`)
            return data
        }

        player_final_percent = latestFramePercents[player_num]
        opponent_final_percent = latestFramePercents[opponent_num]
        end_more_kills = player_kills > opponent_kills
        end_lower_percent = (player_kills == opponent_kills) && player_final_percent < opponent_final_percent

        // disabled due to perceived inconsistencies
        // try {
        //     end_opponent_LRAS = (game.getGameEnd().lrasInitiatorIndex == opponent_num)
        //     end_player_LRAS = (game.getGameEnd().lrasInitiatorIndex == player_num)
        // }
        // catch {
        //     end_opponent_LRAS = false
        //     end_player_LRAS = false
        // } 

        // Every death is considered the opponent's kill
        // If the player didn't quit out AND has more kills than the opponent, the same but with a lower percent, or the opponent quits out: it's a win, otherwise it's a loss. Ties handled above
        // if (!end_player_LRAS && (end_more_kills || end_lower_percent || end_opponent_LRAS)) {
        if (end_more_kills || end_lower_percent) {
            console.log(`${num}: ${player_name || player_codes[player_num]} (${player_character}) \x1b[36mwon\x1b[0m vs ${opponent_name || opponent_code} (${opponent_character}) on ${stages[stage_num]} in ${game_length}! (${file})`)
            data.total_wins = 1
        } else {
            console.log(`${num}: ${player_name || player_codes[player_num]} (${player_character}) \x1b[31mlost\x1b[0m vs ${opponent_name || opponent_code} (${opponent_character}) on ${stages[stage_num]} in ${game_length}. (${file})`)
        }

        data.total_games = 1
        data.player_character_num = player_character_num
        data.player_name = player_name
        data.opponent_character_num = opponent_character_num
        data.opponent_code = opponent_code
        data.stage_num = settings.stageId

        if (player_name.length > 0) {
            data.player_name = player_name
        }
        data.player_code = player_codes[player_num]
        if (opponent_arg && player_names[opponent_num]) {
            if (opponent_name.length > 0) {
                data.opponent_name = opponent_name
            }
            data.opponent_code = player_codes[opponent_num]
        }
        data.game_seconds = game_seconds
        return data
    }
    catch(err) {
        console.log(`${num}: Error reading replay. Ignoring... (${file})`)
        return data
    }
}

function processResults(r) {
    total_games += r.total_games || 0
    total_wins += r.total_wins || 0
    total_seconds += r.total_seconds || 0
    counted_seconds += r.game_seconds || 0

// Try to find last used nickname and actual connect code to display at the end
    if (!!r.player_code) {
        real_player_code = r.player_code
    }
    if (!!r.player_name) {
        final_player_name = r.player_name
    }
    if (!!r.opponent_name) {
        final_opponent_name = r.opponent_name
    }
    if (!!r.opponent_code) {
        real_opponent_code = r.opponent_code
    }
    
    if (!!r.player_character_num || r.player_character_num == 0) {
        character_totals[r.player_character_num] = (character_totals[r.player_character_num] + 1) || 1
        character_playtime[r.player_character_num] = (character_playtime[r.player_character_num] + r.game_seconds) || r.game_seconds
    }

    if (!!r.player_name) {
        nickname_totals[r.player_name] = (nickname_totals[r.player_name] + 1) || 1
        nickname_playtime[r.player_name] = (nickname_playtime[r.player_name] + r.game_seconds) || r.game_seconds
    }

    if (!!r.player_code) {
        code_totals[r.player_code] = (code_totals[r.player_code] + 1) || 1
        code_playtime[r.player_code] = (code_playtime[r.player_code] + r.game_seconds) || r.game_seconds
    }

    if (!!r.opponent_code) {
        opponent_totals[r.opponent_code] = (opponent_totals[r.opponent_code] + 1) || 1
        opponent_playtime[r.opponent_code] = (opponent_playtime[r.opponent_code] + r.game_seconds) || r.game_seconds
    }

    if (!!r.stage_num) {
        stage_totals[r.stage_num] = (stage_totals[r.stage_num] + 1) || 1
        stage_playtime[r.stage_num] = (stage_playtime[r.stage_num] + r.game_seconds) || r.game_seconds
    }

    // If the player won the game
    if (r.total_wins == 1) {
        character_wins[r.player_character_num] = (character_wins[r.player_character_num] + 1) || 1
        character_head_to_head[r.player_character_num][r.opponent_character_num][2] = characters[r.opponent_character_num];
        character_head_to_head[r.player_character_num][r.opponent_character_num][0] = (character_head_to_head[r.player_character_num][r.opponent_character_num][0] + 1)
        nickname_wins[r.player_name] = (nickname_wins[r.player_name] + 1) || 1
        code_wins[r.player_code] = (code_wins[r.player_code] + 1) || 1
        opponent_wins[r.opponent_code] = (opponent_wins[r.opponent_code] + 1) || 1
        stage_wins[r.stage_num] = (stage_wins[r.stage_num] + 1) || 1
    }
    // Else if the player lost the game and it wasn't filtered
    else if (!!r.total_games) {
        character_head_to_head[r.player_character_num][r.opponent_character_num][2] = characters[r.opponent_character_num];
        character_head_to_head[r.player_character_num][r.opponent_character_num][1] = (character_head_to_head[r.player_character_num][r.opponent_character_num][1] + 1)
    }
}

function printResults() {
    if (!total_games) {
        console.log('\n| No games found matching requested parameters.')
        console.log('-------------------------------')
        opponent_arg ? console.log(`| Players: ${user_player} vs ${opponent_arg}`) : console.log(`| Player: ${user_player}`)
        if (player_character_arg) { console.log(`| Player character: ${characters[characters_lowercase.indexOf(player_character_requested)]}`) }
        if (character_arg) { console.log(`| Opponent character: ${characters[characters_lowercase.indexOf(character_requested)]}`) }
        if (ignored_arg) { console.log(`| Ignored opponents: ${ignored_arg}`) }
        console.log('-------------------------------')
        readlineSync.question(`| Try again with different parameters.`)
        process.exit()
    }

    win_rate = (total_wins / total_games * 100).toFixed(2)

    function secondsToHMS(seconds) {
        const format = val => `0${Math.floor(val)}`.replace(/^0+(\d\d)/, '$1')
        const hours = seconds / 3600
        const minutes = (seconds % 3600) / 60  
        return [hours, minutes, seconds % 60].map(format).join(':')
    }

    console.log('\n------- OVERALL RESULTS -------')
    opponent_arg ? console.log(`| ${final_player_name} (${real_player_code}) vs ${final_opponent_name} (${real_opponent_code}) - Includes: ${user_player.join(", ")} vs ${opponent_player.join(", ")}`) : console.log(`| ${final_player_name} (${real_player_code}) - Includes: ${user_player.join(", ")}`)
    if (player_character_arg) { console.log(`| Player character: ${characters[characters_lowercase.indexOf(player_character_requested)]}`) }
    if (character_arg) { console.log(`| Opponent character: ${characters[characters_lowercase.indexOf(character_requested)]}`) }
    if (ignored_arg) { console.log(`| Ignored opponents: ${ignored_arg}`) }
    console.log(`| ${total_wins} wins in ${total_games} games (${win_rate}% win rate)`)
    console.log(`| ${secondsToHMS(counted_seconds)} in analyzed matches. ${secondsToHMS(total_seconds)} including ${files.length - total_games} skipped replays`)

    console.log('-------- STAGE RESULTS --------')
    stage_results = []
    // Calculate stage win rates
    for (i in stage_totals) {
        wins = stage_wins[i] || 0
        games = stage_totals[i]
        winrate = ((wins / games) * 100).toFixed(2) || 0
        stage_results.push({stage: stages[i], wins: wins || 0, games: games, playtime: stage_playtime[i]})
    }

    // Sort stage results list by games won in descending order
    stage_results.sort(function(a, b) {
        return b.wins - a.wins
    })

    // Display stage results
    for (i = 0; i < stage_results.length; i++) {
        winrate = ((stage_results[i].wins / stage_results[i].games) * 100).toFixed(2) || 0
        playtime = secondsToHMS(stage_results[i].playtime)
        console.log(`| ${stage_results[i].stage}: ${stage_results[i].wins} wins in ${stage_results[i].games} games (${winrate}%) - ${playtime}`)
    }

    console.log('------ NICKNAME RESULTS -------')
    // Calculate and display nickname win rates
    for (i in nickname_totals) {
        wins = nickname_wins[i] || 0
        games = nickname_totals[i]
        winrate = ((wins / games) * 100).toFixed(2) || 0
        playtime = secondsToHMS(nickname_playtime[i]) || '00:00:00'
        console.log(`| ${i}: ${wins} wins in ${games} games (${winrate}%) - ${playtime}`)
    }

    if ((Object.keys(code_totals).length) > 1) {
        console.log('------ CODE RESULTS -------')
        // Calculate and display code win rates
        for (i in code_totals) {
            wins = code_wins[i] || 0
            games = code_totals[i]
            winrate = ((wins / games) * 100).toFixed(2) || 0
            playtime = secondsToHMS(code_playtime[i]) || '00:00:00'
            console.log(`| ${i}: ${wins} wins in ${games} games (${winrate}%) - ${playtime}`)
        }
    }

    if (!opponent_arg) {
        console.log('-------- TOP OPPONENTS --------')
        opponent_results = []
        // Calculate opponent win rates
        for (i in opponent_totals) {
            wins = opponent_wins[i] || 0
            games = opponent_totals[i]
            winrate = ((wins / games) * 100).toFixed(2) || 0
            opponent_results.push({code: i, wins: wins || 0, games: games, playtime: opponent_playtime[i]})
        }

        // Sort opponents results list by games played in descending order
        opponent_results.sort(function(a, b) {
            return b.games - a.games
        })

        // Display opponent results (up to 10)
        top_10 = opponent_results.slice(0,10)
        for (i = 0; i < top_10.length; i++) {
            winrate = ((top_10[i].wins / top_10[i].games) * 100).toFixed(2) || 0
            playtime = secondsToHMS(top_10[i].playtime) || '00:00:00'
            console.log(`| ${top_10[i].code}: ${top_10[i].wins} wins in ${top_10[i].games} games (${winrate}%) - ${playtime}`)
        }

        console.log('------ OPPONENT RESULTS -------')

        let winningRecords = 0, losingRecords = 0, evenRecords = 0
        for (i = 0; i < opponent_results.length; i++) {
            const result = opponent_results[i]
            const losses = result.games - result.wins
            const { wins } = result
            if (wins > losses) {
                winningRecords++
            } else if (losses > wins) {
                losingRecords++
            } else {
                evenRecords++
            }
        }
        winPercent = ((winningRecords / opponent_results.length) * 100).toFixed(2) || 0
        console.log(`| Winning record against ${winningRecords} opponents (${winPercent}%)`)
        losePercent = ((losingRecords / opponent_results.length) * 100).toFixed(2) || 0
        console.log(`| Losing record against ${losingRecords} opponents (${losePercent}%)`)
        evenPercent = ((evenRecords / opponent_results.length) * 100).toFixed(2) || 0
        console.log(`| Even record against ${evenRecords} opponents (${evenPercent}%)`)
    }

    if (!player_character_arg) {
        console.log('------ CHARACTER RESULTS ------')
        character_results = []
        // Calculate character win rates
        for (i in character_totals) {
            wins = character_wins[i] || 0
            games = character_totals[i]
            winrate = ((wins / games) * 100).toFixed(2) || 0

            // Sort head-to-head results by games won in descending order
            character_head_to_head[i].sort((a,b) => b[0] - a[0]);

            character_results.push({character: characters[i], wins: wins || 0, games: games, playtime: character_playtime[i], head_to_head: character_head_to_head[i]})
        }

        // Sort character results list by games won in descending order
        character_results.sort(function(a, b) {
            return b.wins - a.wins
        })

        // Display character results
        for (i = 0; i < character_results.length; i++) {
            winrate = ((character_results[i].wins / character_results[i].games) * 100).toFixed(2) || 0
            playtime = secondsToHMS(character_results[i].playtime)
            console.log(`| ${character_results[i].character}: ${character_results[i].wins} wins in ${character_results[i].games} games (${winrate}%) - ${playtime}`)

            for (j in character_results[i].head_to_head) {
                h2h_wins = character_results[i].head_to_head[j][0];
                h2h_losses = character_results[i].head_to_head[j][1];
                h2h_total = h2h_wins + h2h_losses;
                h2h_winrate = ((h2h_wins / h2h_total) * 100).toFixed(2);

                if (h2h_total > 0) {
                    console.log(`| -- vs. ${character_results[i].head_to_head[j][2]} - ${h2h_wins} wins in ${h2h_total} games (${h2h_winrate}%)`);
                }
            }
        }
    }

    console.log('-------------------------------')
    console.log(`| Scan complete. ${new_replays} new replays have been added to ${cacheFilePath}.`)
}

// This prevents Enter from closing the program
process.stdin.resume()