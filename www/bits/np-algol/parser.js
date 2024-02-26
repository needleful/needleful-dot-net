
function parseAlgol(text, options = {}) {
	const Pc = {
		begin: 'begin',
		end: 'end',
		comment: 'comment',
		own: 'own',
		types: ['real', 'integer', 'Boolean'],
		procedure: 'procedure',
		semicol: ';',
		comma: ',',
		assign: ':=',
		postComment: /^([^;]*);?/,
		identPart: /^\p{Alpha}[\p{Alpha}\d]*/u,
		ofType:/^(real|integer|Boolean)/,
		anyToken:/^\S+/
	};
	const keywords = Object.values(Pc).flat();

	function getPositions(...indeces) {
		let result = {};
		let keys = Array.from(indeces).sort();
		let column = 0, line = 0, next_result = 0;
		for(let c = 0; c < text.length && next_result < keys.length; c++){
			while(c == keys[next_result]) {
				result[keys[next_result]] = {line:line, column:column};
				next_result++;
			}
			if(text[c] == '\n'){
				column = 0;
				line ++;
			}
			else {
				column ++;
			}
		}
		// Beyond the end of the text
		for(; next_result < keys.length; next_result++) {
			result[keys[next_result]] = {line:line, column:column};
		}
		return indeces.map(i => result[i]);
	}

	function perr(location, text) {
		let [loc] = getPositions(location);
		throw {text:text, location:loc};
	}

	function pwarn(location, text) {
		let [loc] = getPositions(location);
		console.log("Warning: ", text, "at: ", loc);
	}

	let c = 0;

	function good() {
		return c < text.length;
	}

	function declaration(type, own = false) {
		let vars = [];
		function checkWord(word) {
			if (keywords.includes(word)) {
				pwarn(c, `Variable name includes keyword: {${word}}. Is that correct?`);
				return true;
			}
			return false;
		}
		let declEnd = false;
		while(good() && !declEnd) {
			let word = grabToken(Pc.identPart);
			if(!word) {
				if(grabToken(Pc.comma)) {
					perr(c, `Empty item (or extra comma) in declarations list`);
				}
				else if(grabToken(Pc.semicol)) {
					perr(c, `Declarations list can't be empty.`);
				}
				else{
					perr(c, `Expected an identifier, found {${grabToken(Pc.anyToken)}}`);
				}
			}
			checkWord(word, options);
			let wordEnd = false;
			while(good() && !wordEnd) {
				let w2 = grabToken(Pc.identPart);
				if(w2) {
					checkWord(w2);
					word += w2;
				}
				else if(grabToken(Pc.comma)){
					wordEnd = true;
				}
				else if(grabToken(Pc.semicol)){
					wordEnd = true;
					declEnd = true;
				}
				else {
					perr(c, `Unexpected token during variable declaration: {${grabToken(Pc.anyToken)}}`);
				}
			}
			vars.push(word);
		}
		return {decl: type, own: own, vars:vars};
	}

	function blockHead() {
		let declarations = [];
		while(good()) {
			if(peekToken(Pc.begin) || peekToken(Pc.end)) {
				break;
			}
			let word = grabToken(/^\p{Alpha}+/u);
			if(word == Pc.own) {
				let next = grabToken(Pc.ofType);
				if (!next){
					perr(c, `Expected one of [${Pc.types}] after {own}. Found {${next}}`)
				}
				declarations.push(declaration(next, true));
			}
			else if(word == Pc.comment) {
				grabToken(Pc.postComment);
			}
			else if(Pc.types.includes(word)) {
				declarations.push(declaration(word));
			}
			else if(grabToken(Pc.semicol)) {
				break;
			}
			else {
				perr(c, 'Unexpected token in block head: '+word);
			}
		}
		return declarations;
	}

	function blockTail() {
		let block = [];
		let ended = false;
		while(good()) {
			let word = grabToken(Pc.identPart);
			if(word == Pc.own) {
				perr(c, "Cannot declare new variables after the block head");
			}
			else if(word == Pc.begin) {
				let head = blockHead();
				let tail = blockTail();
				block.push({head:head, tail:tail});
			}
			else if(word == Pc.end) {
				let comment = grabToken(Pc.postComment);
				if(!comment) {
					pwarn(c, `Expected a semicolon after 'end'.`);
				}
				else if(comment.indexOf('\n') >= 0 && comment.indexOf('end') >= 0) {
					pwarn(c, `Comment after 'end' extends more than one line. Is that intentional?`);
				}
				ended = true;
				break;
			}
			else {
				pwarn(c, "I don't know what this means in this context: ", word);
			}
		}
		if(!ended) {
			perr(c, 'Document ended with more `begin` than `end` brackets.');
		}
		return block;
	}

	function skipWhiteSpace(){
		let s1 = text.substr(c, 10);
		while(c < text.length && text[c].match(/\s/)) {
			c++;
		}
	}

	// peek at the token, and advance if it exists.
	function grabToken(query) {
		let r = peekToken(query);
		if(r) {
			c += r.length;
		}
		return r;
	}

	// Match string or regex
	// Regexes should have ^ at the front
	function peekToken(query) {
		skipWhiteSpace();
		if(typeof(query) == 'string') {
			return text.startsWith(query, c) ? query : false;
		}
		else {
			let m = text.substr(c).match(query);
			return m? m[0] : null; 
		}
	}

	if(!grabToken(Pc.begin)) {
		perr(c, 'Expected keyword {begin} to start the program.');
	}
	let head = blockHead();
	let tail = blockTail();
	return {head: head, tail: tail};
}
