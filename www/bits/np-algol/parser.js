// Next up: declare own variables and arrays
// Also, simplify position
// Just track the character index and get the rest on error/warning.
function parseAlgol(rawText) {
	const Ps = {
		Start: 0,
		Block: 1,
		Declaration: 2,

		BlockEnd: 99,
		ProgramEnd: 100
	};

	const Pc = {
		begin: "begin",
		end: "end",
		semicol: ';',
		comma: ',',
		assign: ':=',
		types: ['real', 'integer', 'Boolean']
	};

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
		throw {text:text, location:location, context:context};
	}

	function pwarn(location, context, text) {
		console.log(text, "at: ", location, "in context:", context);
	}
	
	let text = rawText.normalize('NFC');
	let state = Ps.Start;
	let line = 0;
	let column = 0;
	let context = {start:[0,0,0], end:[0,0,0]};
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
		return ` Are you missing a semicolon after 'end' on line ${context.start[0]}, column ${context.start[1]}?`;
	}
	function missingBlockHeuristic(c) {
		// There's at least one extra 'end' between the real 'end' and the semicolon, implying too much code was commented out.
		let startIndex = context.start[2] + 3;
		return(text.substr(startIndex, c - startIndex).includes("end"));
	}

	function nextLine() {
		column = 0;
		line += 1;
	}
	
	for(let c = 0; c < text.length; c++) {
		let old_c = c;
		let char = text[c];
		if(isWhiteSpace(char)){
			if(char == '\n') {
				nextLine();
				continue;
			}
		}
		else if(state == Ps.Start) {
			if(!nextKeyword(Pc.begin, c)) {
				context.start = [0,0];
				context.end = [line, column, c];
				perr([line, column, c], context,
					 `Expected keyword '${Pc.begin}' to start the program.`,);
			}
			context.start = [line,column];
			state = Ps.Block;
			c += Pc.begin.length - 1;
		}
		else if(state == Ps.Block) {
			if(nextKeyword(Pc.end, c)) {
				state = Ps.BlockEnd;
				context.start = [line, column, c];
				c += Pc.end.length - 1;
			}
			else if(nextKeyword(Pc.begin, c)) {
				context.start = [line, column, c];
				let new_tree = {block: [], up: tree};
				tree.block.push(new_tree);
				tree = new_tree;
				c += Pc.begin.length - 1;
			}
			else if(isAlpha(char)) {
				context.start = [line, column, c];
				let word;
				[word, c, char] = grabWord(c);
				context.end = [line, column + word.length, c];
				
				if(Pc.types.includes(word)) {
					context.start = context.end;
					let declaration = {declare: word, vars: [], up: tree};
					tree.block.push(declaration);
					tree = declaration;
					state = Ps.Declaration;
					// Undo the for-loop's witch craft
					c--;
				}
				else {
					pwarn(context.end, context, `Unknown text: {${word}}`);
				}
			}
		}
		else if(state == Ps.Declaration) {
			context.end = [line, column, c];
			let listEnd = text.indexOf(Pc.semicol, c);
			if(listEnd == -1) {
				perr(context.end, context, "File ended unexpectedly.");
			}
			let subc = c;
			let decl = text.substr(c, listEnd-c);
			if(!decl.match(/\S/)) {
				context.end[2] = listEnd;
				perr(context.end, context, "No variables declared for type "+tree.declare);
			}
			let wordContext = {start:context.start, end: context.end};
			for(let varname of decl.split(Pc.comma)) {
				let v = varname.replaceAll(/\s/g, '');
				if(v.length == 0) {
					context.end[2] = subc + varname.length;
					perr(context.end, context, "Empty item in declarator list. Expected an identifier.");
				}
				if(!isAlpha(v[0])) {
					context.end[2] = subc + varname.length;
					perr([line, column + subc - c, subc], context, 
						`Unexpected symbols instead of a variable name: {${varname}}`);
				}
				let ec = v.match(/[^\p{Alpha}\d]/u);
				if(ec) {
					index = varname.indexOf(ec);
					context.end[2] = subc+varname.length;
					perr([line, column + index + subc - c, subc + index], context, 
						`Unexpected invalid character {${ec}} in identifier {${varname}}`)
				}
				if(tree.vars.includes(v)) {
					context.end[2] = subc + varname.length;
					perr([line, column + subc - c, subc], context, 
						"Duplicate variable declared: " + v);
				}
				tree.vars.push(v);
				
				subc += varname.length + 1;
				context.end[2] = subc;
			}
			if(tree.vars.length == 0) {
				perr(context.end, context, "No variables were declared of type: "+tree.declare);
			}
			tree = tree.up;
			c = listEnd;
			state = Ps.Block;
		}
		else if(state == Ps.BlockEnd) {
			// Any text between the "end" bracket and the semicolon is a comment. Coolio!
			if(char == Pc.semicol) {
				context.end = [line, column, c];
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
				context.end = [line, column, c];
				perr([line, column, c], context, "You've added more code after the final 'end;': "+text.substr(c)); 
			}
		}
		column += 1 + (c - old_c);
	}

	if(tree != top_tree) {
		context.end = [line, column, text.length];
		console.log("Program: ", top_tree, "Final tree:", tree);
		perr(context.end, context, "Program ended with more 'begin's than 'end's." + (state == Ps.BlockEnd ? endCommentHint() : ""));
	}
	else if(state != Ps.ProgramEnd) {
		if(state != Ps.BlockEnd) {
			context.end = [line, column, text.length];
			perr(context.end, context, "Missing the final 'end' bracket." + missingBlockHeuristic(text.length)? endCommentHint() : "");
		}
		else {
			context.end = [line, column, text.length];
			pwarn(context.end, context, "A semicolon is recommended at the end of the program.");
		}
	}
	return top_tree;
}