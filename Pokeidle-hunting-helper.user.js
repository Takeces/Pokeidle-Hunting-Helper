// ==UserScript==
// @name         PokeIdle Hunting Helper
// @namespace    Pokeidle
// @version      2.1
// @description  Highlights routes blue if all Pokemon there have been caught and adds a checkmark if enough for all evolutions have been caught there. Highlight gets golden when all Pokemon there have been caught as shiny and checkmark gets yellow if enough shinies for all evolutions have been caught.
// @author       Takeces aka Akerus
// @match        https://pokeidle.net/*
// @grant        GM_addStyle
// ==/UserScript==

(function() {

    GM_addStyle('li.norm-all {background-color: #6995f3;}');
    GM_addStyle('li.norm-all-evo:after {content: "✓";}');
    GM_addStyle('li.shiny-all {background-color: gold;}');
    GM_addStyle('li.shiny-all-evo:after {content: "✓"; color: yellow; text-shadow: 0px 0px 3px black;}');

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
        // this is needed to handle full cycle evolution pokemons (like Rotom in Sinnoh - Strange TV and others)
        var evosTmp = [first];
        while(firstTmp = getPreviousEvo(first)) {
            if(!firstTmp) break;
            // if a full cycle is detected abort and continue with initial pokemon as first
            if(evosTmp.includes(firstTmp)) {
                first = name;
                break;
            }
            evosTmp.push(firstTmp);
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
            return pokeByName(EVOLUTIONS[name]['to']).pokemon[0].DisplayName;
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

    function checkForRouteMarking(pokemonName, shiny) {
		if(shiny) {
			var allPokemon = getAllPlayersPokemon();
			return typeof allPokemon.find(function(obj){ return (this[0] == obj.pokeName() && this[1] == obj.shiny()); }, [pokemonName, shiny]) != 'undefined';
		}
		return typeof player.pokedexData().find(function(obj){ return this[0] == obj.name && obj.flag > 2;}, [pokemonName]) != 'undefined';
    }

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
				if(!checkForRouteMarking(route.pokes[i], false)){
					gotAll = false;
					break;
				}
			}
            // Getting information about enough Pokemon for all evolutions.
			var gotAllEvo = true;
            for(i = 0; i < route.pokes.length; i++) {
                var evos = getAllEvolutions(route.pokes[i]);
                evos = evos.slice(evos.indexOf(route.pokes[i]));
                var allPokes = getAllPlayersPokemon();
                var no = 0;
                for(var name of evos) {

                    var found = allPokes.reduce((a, e, i) => e.pokeName() === name ? a.concat(i) : a, []);
                    no += found.length;
                }
                if(no < evos.length) {
                    gotAllEvo = false;
                    break;
                }
			}
            // Getting information if we already got all Pokemon on this route in shiny form
			var gotAllShiny = true;
			for(i = 0; i < route.pokes.length; i++) {
				if(!checkForRouteMarking(route.pokes[i], true)){
					gotAllShiny = false;
					break;
				}
			}
            // Getting information about enough shiny Pokemon for all evolutions.
            var gotAllShinyForEvo = true;
            for(i = 0; i < route.pokes.length; i++) {
                evos = getAllEvolutions(route.pokes[i]);
                evos = evos.slice(evos.indexOf(route.pokes[i]));
                allPokes = getAllPlayersPokemon();
                no = 0;
                for(name of evos) {

                    found = allPokes.reduce((a, e, i) => (e.pokeName() === name & e.shiny()) ? a.concat(i) : a, []);
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
                , `<li class="${gotAll?'norm-all':''} ${gotAllEvo?'norm-all-evo':''} ${gotAllShiny?'shiny-all':''} ${gotAllShinyForEvo?'shiny-all-evo':''}">
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
                    || 'rgb(176, 180, 184)' )
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
