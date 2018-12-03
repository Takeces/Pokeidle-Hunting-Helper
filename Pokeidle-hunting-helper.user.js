// ==UserScript==
// @name         PokeIdle Shiny Hunting
// @namespace    Pokeidle
// @version      1.0
// @description  Adds CSS to extend the game view for fullscreen browser windows
// @author       Akerus aka Takeces
// @match        https://richardpaulastley.github.io/
// @grant        GM_addStyle
// ==/UserScript==

(function() {

    GM_addStyle('li.norm-all {background-color: #6995f3;}');
    GM_addStyle('li.shiny-all {background-color: gold;}');
    GM_addStyle('li.shiny-all-evo:after {content: "✓";}');

    const domQuery = (cssQuery) => document.querySelector(cssQuery);
    const $ = domQuery;

    var evos = Object.entries(EVOLUTIONS).map(([name, evo]) => ({name, evo}));

    /**
     * Gets all evolutions for a Pokemon.
     * Traces back to first form and then gets all evolutions from there.
     * (Example: from Kadabra to Abra and then finds [Abra, Kadabra, Alakazam])
     */
    function getAllEvolutions(name) {

        var first = name;
        var firstTmp = '';
        while(firstTmp = getPreviousEvo(first)) {
            if(!firstTmp) break;
            first = firstTmp;
        }

        var evos = [first];
        var tmp = first;
        while(tmp = getEvolution(tmp)) {
            if(evos.includes(tmp)) break;
            evos.push(tmp);
        }
        return evos;
    }

    /**
     * Gets the evolution of a Pokemon.
     * @param [string] name Name of the Pokemon
     * @return [string] Name of the evolution | null if nothing found
     */
    function getEvolution(name) {
        if(EVOLUTIONS.hasOwnProperty(name)) {
            return EVOLUTIONS[name]['to'];
        }
        return null;
    }

    /**
     * Gets the previous evolution for a Pokemon.
     * @param [string] name Name of the Pokemon
     * @return [string] Name of the previous evolution |null if nothing found
     */
    function getPreviousEvo(name) {
        var info = evos.find(obj => obj.evo.to == name);
        if(info) return info.name;
        return null;
    }

    /**
     * Gets all Pokemon of the player. Includes Pokemon currently in storage.
     * @return [array] of Pokemon
     */
    function getAllPlayersPokemon() {
        var allPokemon = player.pokemons();
        if (player.storage().length > 0) {
            allPokemon = allPokemon.concat(player.storage());
        }
        return allPokemon;
    }


    /**
     * Overwrite of the original player.hasPokemon() function.
     * Originally this would only check if the player has the Pokemon in his inventory or storage.
     * Now we're looking differently:
     * If it is shiny, we want to look in inventory and storage -> living shiny dex
     * Else we look into the Pokedex -> has it already been caught once?
     */
	player.hasPokemon = function (pokemonName, shiny) {
		if(shiny) {
			var allPokemon = getAllPlayersPokemon();
			return typeof allPokemon.find(function(obj){ return (this[0] == obj.pokeName() && this[1] == obj.shiny()); }, [pokemonName, shiny]) != 'undefined';
		}
		return typeof player.pokedexData().find(function(obj){ return this[0] == obj.name && obj.flag > 2;}, [pokemonName]) != 'undefined';
	};

    /**
     * Copy of the original setValue() function. No changes.
     * Had to do this, because I had problems calling the original function.
     */
    function setValue(domElement, newValue, append) {
        if (append === undefined) { append = false; }
        if (append) {
            domElement.innerHTML += newValue;
        }
        if (!append) {
            if (domElement.innerHTML !== newValue) {
                domElement.innerHTML = newValue;
            }
        }
    }

    /**
     * Overwrite of the original renderRouteList() function.
     * Here we do our checks:
     * Did we catch every Pokemon on this route?
     * Did we catch every Pokemon on this route as a shiny?
     * Did we catch enough shiny Pokemon on this route to support all evolutions?
     */
    dom.renderRouteList = function (id, routes) {
        const listCssQuery = '.container.list' + '#' + id;
        const listContainer = $(listCssQuery);
        const listElement = listContainer.querySelector('.list');
        listContainer.querySelector('#regionSelect').value = userSettings.currentRegionId;
        setValue(listElement, '');
        Object.keys(routes).forEach((routeId) => {
            const route = routes[routeId];
            // Getting information if we already catched every Pokemon on this route
			var gotAll = true;
			for(var i = 0; i < route.pokes.length; i++) {
				if(!player.hasPokemon(route.pokes[i], false)){
					gotAll = false;
					break;
				}
			}
            // Getting information if we already got all Pokemon on this route in shiny form
			var gotAllShiny = true;
			for(i = 0; i < route.pokes.length; i++) {
				if(!player.hasPokemon(route.pokes[i], true)){
					gotAllShiny = false;
					break;
				}
			}
            // Getting information about enough Pokemon for all evolutions.
            var gotAllShinyForEvo = true;
            for(i = 0; i < route.pokes.length; i++) {
                var evos = getAllEvolutions(route.pokes[i]);
                evos = evos.slice(evos.indexOf(route.pokes[i]));
                var allPokes = getAllPlayersPokemon();
                var no = 0;
                for(name of evos) {

                    var found = allPokes.reduce((a, e, i) => (e.pokeName() === name & e.shiny()) ? a.concat(i) : a, []);
                    no += found.length;
                }
                if(no < evos.length) {
                    gotAllShinyForEvo = false;
                    break;
                }
			}

            // set our information
            setValue(
                listElement
                , `<li class="${gotAll?'norm-all':''} ${gotAllShiny?'shiny-all':''} ${gotAllShinyForEvo?'shiny-all-evo':''}">
          <a
          href="#"
          onclick="${route.unlocked
                && 'userInteractions.changeRoute(\'' + routeId + '\')'
                || ''
                    }"
          "
            style="
            color: ${route.unlocked
                && (routeId === userSettings.currentRouteId
                    && 'rgb(51, 111, 22)'
                    || 'rgb(53, 50, 103)' )
                || 'rgb(167, 167, 167)'
                    };
            font-weight: ${routeId === userSettings.currentRouteId
                && 'bold'
                || 'normal'
                    };
           "
           >
             ${route.name + ' (' + route.minLevel + '~' + route.maxLevel + ')'}
           </a>
        </li>`
                , true
            );
        });
    };

    /**
     * Overwrite of the original player-addPokedex() function.
     * Only difference is, that we now render the route list for every caught pokemon to update the visual keys
     */
    player.addPokedex = function (pokeName, flag) {
		/* 0 Unseen
		1 Normal, Seen
		2 Shiny, Seen
		3 Normal, Released [italic]
		4 Shiny, Released [italic]
		5 Normal, Owned (so evolved)
		6 Normal, Own (actual form in the team)
		7 Shiny, Owned
		8 Shiny, Own */
		function findFlag(obj){ return (this == obj.name); }
		const dexEntry = player.pokedexData().find(findFlag, pokeName);
		if (typeof dexEntry == 'object') {
			if (dexEntry.flag < flag ||
				(dexEntry.flag == 8 && flag == 4) || // own can be released
				(dexEntry.flag == 6 && flag == 3) ||
				(dexEntry.flag == 8 && flag == 7) || // own can be come owned
				(dexEntry.flag == 6 && flag == 5)) {
				player.pokedexData()[player.pokedexData().indexOf(dexEntry)].flag = flag;
			}
		} else {
			player.pokedexData().push({name: pokeName, flag: flag});
		}
		dom.renderRouteList('areasList', ROUTES[userSettings.currentRegionId]);
	};

	dom.renderRouteList('areasList', ROUTES[userSettings.currentRegionId]);

})();
