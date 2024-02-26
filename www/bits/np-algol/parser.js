// Next up: procedure calls
function parseAlgol(text, options = {}) {
	const Ps = {
		Start: 1,
		Block: 2,
		Declaration: 3,
		OwnDeclaration: 4,
		ProcedureCall: 5,

		BlockEnd: 99,
		ProgramEnd: 100,
		ParserBroke: 0
	};

	const Pc = {
		begin: 'begin',
		end: 'end',
		comment: 'comment',
		semicol: ';',
		comma: ',',
		assign: ':=',
		own: 'own',
		types: ['real', 'integer', 'Boolean']
	};

	const keywords = Object.values(Pc).flat();

	function getPositions(...indeces) {
		let result = {};
		let keys = Array.from(indeces).sort();
		let column = 0;
		let line = 0;
		let next_result = 0;
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

	function isWhiteSpace(char) {
		return char.match(/\s/);
	}

	function isDigit(char) {
		return char.match(/\d/);
	}

	function isAlpha(char) {
		return char.match(/\p{Alpha}/u);
	}

	function perr(location, context, text) {
		let [loc, start, end] = getPositions(location, context.start, context.end);
		throw {text:text, location:loc, context:{start:start, end:end}};
	}

	function pwarn(location, context, text) {
		let [loc, start, end] = getPositions(location, context.start, context.end);
		console.log("Warning: ", text, "at: ", loc, "in context:", {start:start, end:end});
	}

	let state = Ps.Start;
	let context = {start:0, end:0};
	let top_tree = {block: []};
	let tree = top_tree;

	function nextKeyword(substring, start) {
		if(!text.startsWith(substring, start)) {
			return false;
		}
		else if(text.length <= start + substring.length) {
			return true;
		}
		else {
			let lastChar = text[start + substring.length];
			return (isWhiteSpace(lastChar) || lastChar == Pc.semicol);
		}
	}
	function grabWord(c) {
		let start = c;
		let char;
		do{ char = text[++c]; } while(isAlpha(char) || isDigit(char));
		return [text.substr(start, c-start), c, char];
	}

	function endCommentHint() {
		let [start] = getPositions(context.start);
		return ` Are you missing a semicolon after 'end' on line ${start.line}, column ${start.column}?`;
	}
	function missingBlockHeuristic(c) {
		// There's at least one extra 'end' between the real 'end' and the semicolon, implying too much code was commented out.
		let startIndex = context.start[2] + 3;
		return(text.substr(startIndex, c - startIndex).includes("end"));
	}
	function startDeclaration(type, owned) {
		if(tree.nested_blocks) {
			perr(context.start, context, `You cannot declare more variables after a nested block.`);
		}
		context.start = context.end;
		let declaration = {declare: type, own:owned, vars: [], up: tree};
		tree.block.push(declaration);
		tree = declaration;
		state = Ps.Declaration;
	}
	function startProcCall(procName) {
		let pcall = {call: procName, block: [], up: tree};
		tree.block.push(pcall);
		tree = pcall;
		state = Ps.ProcedureCall;
	}
	
	for(let c = 0; c < text.length; c++) {
		if(!state) {
			perr(c, context, "Parser Bug: something broke the parser before this location.");
		}
		let old_c = c;
		let char = text[c];
		if(isWhiteSpace(char)){}
		else if(state == Ps.Start) {
			if(!nextKeyword(Pc.begin, c)) {
				context.start = 0;
				context.end = c;
				perr(c, context,`Expected keyword '${Pc.begin}' to start the program.`);
			}
			context.start = c;
			state = Ps.Block;
			c += Pc.begin.length - 1;
		}
		else if(state == Ps.Block) {
			if(nextKeyword(Pc.end, c)) {
				state = Ps.BlockEnd;
				context.start = c;
				c += Pc.end.length - 1;
			}
			else if(nextKeyword(Pc.begin, c)) {
				context.start = c;
				let new_tree = {block: [], up: tree};
				tree.nested_blocks = true;
				tree.block.push(new_tree);
				tree = new_tree;
				c += Pc.begin.length - 1;
			}
			else if(nextKeyword(Pc.comment, c)) {
				context.start = c;
				let commentEnd = text.indexOf(Pc.semicol, c);
				if(commentEnd == -1) {
					context.end = text.length;
					perr(c, context, "Comment was not punctuated with a semicolon.");
				}
				c = context.start = context.end = commentEnd;
			}
			else if(isAlpha(char)) {
				context.start = c;
				let word;
				[word, c, char] = grabWord(c);
				context.end = c;
				if(word == Pc.own) {
					state = Ps.OwnDeclaration;
				}
				else if(Pc.types.includes(word)) {
					startDeclaration(word, false);
					// Undo the for-loop's witch craft
				}
				else {
					startProcCall(word);
				}
				c--;
			}
		}
		else if(state == Ps.OwnDeclaration) {
			let word;
			[word, c, char] = grabWord(c);
			context.end = c;
			if(Pc.types.includes(word)){
				startDeclaration(word, true);
				c--;
			}
			else {
				perr(c, context, `Expected one of [${Pc.types}] for own variable declaration, found {${word}}`);
			}
		}
		else if(state == Ps.Declaration) {
			context.end = c;
			let listEnd = text.indexOf(Pc.semicol, c);
			if(listEnd == -1) {
				perr(c, context, "File ended unexpectedly in declaration.");
			}
			let subc = c;
			let decl = text.substr(c, listEnd-c);
			if(!decl.match(/\S/)) {
				context.end = listEnd;
				perr(c, context, "No variables declared for type "+tree.declare);
			}
			for(let varname of decl.split(Pc.comma)) {
				let v = varname.replaceAll(/\s/g, '');
				if(v.length == 0) {
					context.end = subc + varname.length;
					perr(c, context, "Empty item in declarator list. Expected an identifier.");
				}
				if(!isAlpha(v[0])) {
					context.end = subc + varname.length;
					perr(subc, context, 
						`Unexpected symbols instead of a variable name: {${varname}}`);
				}
				let ec = v.match(/[^\p{Alpha}\d]/u);
				if(ec) {
					index = varname.indexOf(ec);
					context.end = subc+varname.length;
					perr(subc + index, context, 
						`Unexpected invalid character {${ec}} in identifier {${varname}}. Identifiers are only letters and numbers.`);
				}
				if(tree.vars.includes(v)) {
					context.end = subc + varname.length;
					perr(subc, context, "Duplicate variable declared: " + v);
				}
				let vt = varname.trim().replaceAll(/\s+/g, ' ');
				if(v != vt && !options.multiWordIdents) {
					pwarn(subc, context, `Whitespace in identifier {${vt}}. Reading as {${v}}.`)
				}
				if(keywords.includes(vt)) {
					pwarn(subc, context, `Variable {${tree.declare} ${vt}} has the same name as a keyword. Is this deliberate?`);
				}
				tree.vars.push(v);
				
				subc += varname.length + 1;
				context.end = subc;
			}
			if(tree.vars.length == 0) {
				perr(c, context, "No variables were declared of type: "+tree.declare);
			}
			tree = tree.up;
			c = listEnd;
			state = Ps.Block;
		}
		else if(state == Ps.ProcedureCall) {
			
		}
		else if(state == Ps.BlockEnd) {
			// Any text between the "end" bracket and the semicolon is a comment. Coolio!
			if(char == Pc.semicol) {
				context.end = c;
				if(missingBlockHeuristic(c)){
					pwarn(context.end, context, endCommentHint());
				}
				if(!tree.up) {
					state = Ps.ProgramEnd;
				}
				else {
					tree = tree.up;
					state = Ps.Block;
				}
			}
		}
		else if(state == Ps.ProgramEnd) {
			if(!isWhiteSpace(char)) {
				context.end = c;
				perr(c, context, "You've added more code after the final 'end;': "+text.substr(c)); 
			}
		}
	}

	if(tree != top_tree) {
		context.end = text.length;
		console.log("Program: ", top_tree, "Final tree:", tree);
		perr(context.end, context, "Program ended with more 'begin's than 'end's." + (state == Ps.BlockEnd ? endCommentHint() : ""));
	}
	else if(state != Ps.ProgramEnd) {
		if(state != Ps.BlockEnd) {
			context.end = text.length;
			perr(context.end, context, "Missing the final 'end' bracket." + missingBlockHeuristic(text.length)? endCommentHint() : "");
		}
		else {
			context.end = text.length;
			pwarn(context.end, context, "A semicolon is recommended at the end of the program.");
		}
	}
	return top_tree;
}