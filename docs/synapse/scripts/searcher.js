var _____WB$wombat$assign$function_____ = function(name) {
    return (self._wb_wombat && self._wb_wombat.local_init && self._wb_wombat.local_init(name)) || self[name];
};
if (!self.__WB_pmw) {
    self.__WB_pmw = function(obj) {
        this.__WB_source = obj;
        return this;
    }
}
{
    let window = _____WB$wombat$assign$function_____("window");
    let self = _____WB$wombat$assign$function_____("self");
    let document = _____WB$wombat$assign$function_____("document");
    let location = _____WB$wombat$assign$function_____("location");
    let top = _____WB$wombat$assign$function_____("top");
    let parent = _____WB$wombat$assign$function_____("parent");
    let frames = _____WB$wombat$assign$function_____("frames");
    let opener = _____WB$wombat$assign$function_____("opener");

    "use strict";
    window.search = window.search || {};
    (function search(search) {
        if (!Mark || !elasticlunr) {
            return;
        }
        if (!String.prototype.startsWith) {
            String.prototype.startsWith = function(search, pos) {
                return this.substr(!pos || pos < 0 ? 0 : +pos, search.length) === search;
            }
            ;
        }
        var search_wrap = document.getElementById('search-wrapper')
          , searchbar = document.getElementById('searchbar')
          , searchbar_outer = document.getElementById('searchbar-outer')
          , searchresults = document.getElementById('searchresults')
          , searchresults_outer = document.getElementById('searchresults-outer')
          , searchresults_header = document.getElementById('searchresults-header')
          , searchicon = document.getElementById('search-toggle')
          , content = document.getElementById('content')
          , searchindex = null
          , doc_urls = []
          , results_options = {
            teaser_word_count: 30,
            limit_results: 30,
        }
          , search_options = {
            bool: "AND",
            expand: true,
            fields: {
                title: {
                    boost: 1
                },
                body: {
                    boost: 1
                },
                breadcrumbs: {
                    boost: 0
                }
            }
        }
          , mark_exclude = []
          , marker = new Mark(content)
          , current_searchterm = ""
          , URL_SEARCH_PARAM = 'search'
          , URL_MARK_PARAM = 'highlight'
          , teaser_count = 0
          , SEARCH_HOTKEY_KEYCODE = 83
          , ESCAPE_KEYCODE = 27
          , DOWN_KEYCODE = 40
          , UP_KEYCODE = 38
          , SELECT_KEYCODE = 13;
        function hasFocus() {
            return searchbar === document.activeElement;
        }
        function removeChildren(elem) {
            while (elem.firstChild) {
                elem.removeChild(elem.firstChild);
            }
        }
        function parseURL(url) {
            var a = document.createElement('a');
            a.href = url;
            return {
                source: url,
                protocol: a.protocol.replace(':', ''),
                host: a.hostname,
                port: a.port,
                params: (function() {
                    var ret = {};
                    var seg = a.search.replace(/^\?/, '').split('&');
                    var len = seg.length, i = 0, s;
                    for (; i < len; i++) {
                        if (!seg[i]) {
                            continue;
                        }
                        s = seg[i].split('=');
                        ret[s[0]] = s[1];
                    }
                    return ret;
                }
                )(),
                file: (a.pathname.match(/\/([^/?#]+)$/i) || [, ''])[1],
                hash: a.hash.replace('#', ''),
                path: a.pathname.replace(/^([^/])/, '/$1')
            };
        }
        function renderURL(urlobject) {
            var url = urlobject.protocol + "://" + urlobject.host;
            if (urlobject.port != "") {
                url += ":" + urlobject.port;
            }
            url += urlobject.path;
            var joiner = "?";
            for (var prop in urlobject.params) {
                if (urlobject.params.hasOwnProperty(prop)) {
                    url += joiner + prop + "=" + urlobject.params[prop];
                    joiner = "&";
                }
            }
            if (urlobject.hash != "") {
                url += "#" + urlobject.hash;
            }
            return url;
        }
        var escapeHTML = (function() {
            var MAP = {
                '&': '&amp;',
                '<': '&lt;',
                '>': '&gt;',
                '"': '&#34;',
                "'": '&#39;'
            };
            var repl = function(c) {
                return MAP[c];
            };
            return function(s) {
                return s.replace(/[&<>'"]/g, repl);
            }
            ;
        }
        )();
        function formatSearchMetric(count, searchterm) {
            if (count == 1) {
                return count + " search result for '" + searchterm + "':";
            } else if (count == 0) {
                return "No search results for '" + searchterm + "'.";
            } else {
                return count + " search results for '" + searchterm + "':";
            }
        }
        function formatSearchResult(result, searchterms) {
            var teaser = makeTeaser(escapeHTML(result.doc.body), searchterms);
            teaser_count++;
            var url = doc_urls[result.ref].split("#");
            if (url.length == 1) {
                url.push("");
            }
            var searchterms = encodeURIComponent(searchterms.join(" ")).replace(/\'/g, "%27");
            return '<a href="' + path_to_root + url[0] + '?' + URL_MARK_PARAM + '=' + searchterms + '#' + url[1] + '" aria-details="teaser_' + teaser_count + '">' + result.doc.breadcrumbs + '</a>' + '<span class="teaser" id="teaser_' + teaser_count + '" aria-label="Search Result Teaser">' + teaser + '</span>';
        }
        function makeTeaser(body, searchterms) {
            var stemmed_searchterms = searchterms.map(function(w) {
                return elasticlunr.stemmer(w.toLowerCase());
            });
            var searchterm_weight = 40;
            var weighted = [];
            var sentences = body.toLowerCase().split('. ');
            var index = 0;
            var value = 0;
            var searchterm_found = false;
            for (var sentenceindex in sentences) {
                var words = sentences[sentenceindex].split(' ');
                value = 8;
                for (var wordindex in words) {
                    var word = words[wordindex];
                    if (word.length > 0) {
                        for (var searchtermindex in stemmed_searchterms) {
                            if (elasticlunr.stemmer(word).startsWith(stemmed_searchterms[searchtermindex])) {
                                value = searchterm_weight;
                                searchterm_found = true;
                            }
                        }
                        ;weighted.push([word, value, index]);
                        value = 2;
                    }
                    index += word.length;
                    index += 1;
                }
                ;index += 1;
            }
            ;if (weighted.length == 0) {
                return body;
            }
            var window_weight = [];
            var window_size = Math.min(weighted.length, results_options.teaser_word_count);
            var cur_sum = 0;
            for (var wordindex = 0; wordindex < window_size; wordindex++) {
                cur_sum += weighted[wordindex][1];
            }
            ;window_weight.push(cur_sum);
            for (var wordindex = 0; wordindex < weighted.length - window_size; wordindex++) {
                cur_sum -= weighted[wordindex][1];
                cur_sum += weighted[wordindex + window_size][1];
                window_weight.push(cur_sum);
            }
            ;if (searchterm_found) {
                var max_sum = 0;
                var max_sum_window_index = 0;
                for (var i = window_weight.length - 1; i >= 0; i--) {
                    if (window_weight[i] > max_sum) {
                        max_sum = window_weight[i];
                        max_sum_window_index = i;
                    }
                }
                ;
            } else {
                max_sum_window_index = 0;
            }
            var teaser_split = [];
            var index = weighted[max_sum_window_index][2];
            for (var i = max_sum_window_index; i < max_sum_window_index + window_size; i++) {
                var word = weighted[i];
                if (index < word[2]) {
                    teaser_split.push(body.substring(index, word[2]));
                    index = word[2];
                }
                if (word[1] == searchterm_weight) {
                    teaser_split.push("<em>")
                }
                index = word[2] + word[0].length;
                teaser_split.push(body.substring(word[2], index));
                if (word[1] == searchterm_weight) {
                    teaser_split.push("</em>")
                }
            }
            ;return teaser_split.join('');
        }
        function init(config) {
            results_options = config.results_options;
            search_options = config.search_options;
            searchbar_outer = config.searchbar_outer;
            doc_urls = config.doc_urls;
            searchindex = elasticlunr.Index.load(config.index);
            searchicon.addEventListener('click', function(e) {
                searchIconClickHandler();
            }, false);
            searchbar.addEventListener('keyup', function(e) {
                searchbarKeyUpHandler();
            }, false);
            document.addEventListener('keydown', function(e) {
                globalKeyHandler(e);
            }, false);
            window.onpopstate = function(e) {
                doSearchOrMarkFromUrl();
            }
            ;
            document.addEventListener('submit', function(e) {
                e.preventDefault();
            }, false);
            doSearchOrMarkFromUrl();
        }
        function unfocusSearchbar() {
            var tmp = document.createElement('input');
            tmp.setAttribute('style', 'position: absolute; opacity: 0;');
            searchicon.appendChild(tmp);
            tmp.focus();
            tmp.remove();
        }
        function doSearchOrMarkFromUrl() {
            var url = parseURL(window.location.href);
            if (url.params.hasOwnProperty(URL_SEARCH_PARAM) && url.params[URL_SEARCH_PARAM] != "") {
                showSearch(true);
                searchbar.value = decodeURIComponent((url.params[URL_SEARCH_PARAM] + '').replace(/\+/g, '%20'));
                searchbarKeyUpHandler();
            } else {
                showSearch(false);
            }
            if (url.params.hasOwnProperty(URL_MARK_PARAM)) {
                var words = decodeURIComponent(url.params[URL_MARK_PARAM]).split(' ');
                marker.mark(words, {
                    exclude: mark_exclude
                });
                var markers = document.querySelectorAll("mark");
                function hide() {
                    for (var i = 0; i < markers.length; i++) {
                        markers[i].classList.add("fade-out");
                        window.setTimeout(function(e) {
                            marker.unmark();
                        }, 300);
                    }
                }
                for (var i = 0; i < markers.length; i++) {
                    markers[i].addEventListener('click', hide);
                }
            }
        }
        function globalKeyHandler(e) {
            if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey || e.target.type === 'textarea' || e.target.type === 'text') {
                return;
            }
            if (e.keyCode === ESCAPE_KEYCODE) {
                e.preventDefault();
                searchbar.classList.remove("active");
                setSearchUrlParameters("", (searchbar.value.trim() !== "") ? "push" : "replace");
                if (hasFocus()) {
                    unfocusSearchbar();
                }
                showSearch(false);
                marker.unmark();
            } else if (!hasFocus() && e.keyCode === SEARCH_HOTKEY_KEYCODE) {
                e.preventDefault();
                showSearch(true);
                window.scrollTo(0, 0);
                searchbar.select();
            } else if (hasFocus() && e.keyCode === DOWN_KEYCODE) {
                e.preventDefault();
                unfocusSearchbar();
                searchresults.firstElementChild.classList.add("focus");
            } else if (!hasFocus() && (e.keyCode === DOWN_KEYCODE || e.keyCode === UP_KEYCODE || e.keyCode === SELECT_KEYCODE)) {
                var focused = searchresults.querySelector("li.focus");
                if (!focused)
                    return;
                e.preventDefault();
                if (e.keyCode === DOWN_KEYCODE) {
                    var next = focused.nextElementSibling;
                    if (next) {
                        focused.classList.remove("focus");
                        next.classList.add("focus");
                    }
                } else if (e.keyCode === UP_KEYCODE) {
                    focused.classList.remove("focus");
                    var prev = focused.previousElementSibling;
                    if (prev) {
                        prev.classList.add("focus");
                    } else {
                        searchbar.select();
                    }
                } else {
                    window.location.assign(focused.querySelector('a'));
                }
            }
        }
        function showSearch(yes) {
            if (yes) {
                search_wrap.classList.remove('hidden');
                searchicon.setAttribute('aria-expanded', 'true');
            } else {
                search_wrap.classList.add('hidden');
                searchicon.setAttribute('aria-expanded', 'false');
                var results = searchresults.children;
                for (var i = 0; i < results.length; i++) {
                    results[i].classList.remove("focus");
                }
            }
        }
        function showResults(yes) {
            if (yes) {
                searchresults_outer.classList.remove('hidden');
            } else {
                searchresults_outer.classList.add('hidden');
            }
        }
        function searchIconClickHandler() {
            if (search_wrap.classList.contains('hidden')) {
                showSearch(true);
                window.scrollTo(0, 0);
                searchbar.select();
            } else {
                showSearch(false);
            }
        }
        function searchbarKeyUpHandler() {
            var searchterm = searchbar.value.trim();
            if (searchterm != "") {
                searchbar.classList.add("active");
                doSearch(searchterm);
            } else {
                searchbar.classList.remove("active");
                showResults(false);
                removeChildren(searchresults);
            }
            setSearchUrlParameters(searchterm, "push_if_new_search_else_replace");
            marker.unmark();
        }
        function setSearchUrlParameters(searchterm, action) {
            var url = parseURL(window.location.href);
            var first_search = !url.params.hasOwnProperty(URL_SEARCH_PARAM);
            if (searchterm != "" || action == "push_if_new_search_else_replace") {
                url.params[URL_SEARCH_PARAM] = searchterm;
                delete url.params[URL_MARK_PARAM];
                url.hash = "";
            } else {
                delete url.params[URL_MARK_PARAM];
                delete url.params[URL_SEARCH_PARAM];
            }
            if (action == "push" || (action == "push_if_new_search_else_replace" && first_search)) {
                history.pushState({}, document.title, renderURL(url));
            } else if (action == "replace" || (action == "push_if_new_search_else_replace" && !first_search)) {
                history.replaceState({}, document.title, renderURL(url));
            }
        }
        function doSearch(searchterm) {
            if (current_searchterm == searchterm) {
                return;
            } else {
                current_searchterm = searchterm;
            }
            if (searchindex == null) {
                return;
            }
            var results = searchindex.search(searchterm, search_options);
            var resultcount = Math.min(results.length, results_options.limit_results);
            searchresults_header.innerText = formatSearchMetric(resultcount, searchterm);
            var searchterms = searchterm.split(' ');
            removeChildren(searchresults);
            for (var i = 0; i < resultcount; i++) {
                var resultElem = document.createElement('li');
                resultElem.innerHTML = formatSearchResult(results[i], searchterms);
                searchresults.appendChild(resultElem);
            }
            showResults(true);
        }
        fetch(path_to_root + 'searchindex.json').then(response=>response.json()).then(json=>init(json)).catch(error=>{
            var script = document.createElement('script');
            script.src = path_to_root + 'searchindex.js';
            script.onload = ()=>init(window.search);
            document.head.appendChild(script);
        }
        );
        search.hasFocus = hasFocus;
    }
    )(window.search);

}