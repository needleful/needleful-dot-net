/*
	This is an adaptation of Brad Robinson's
	Source: https://stackoverflow.com/a/45396754/2107659
	I have stolen the code from gcoulby: https://jsfiddle.net/2wkrhxLt/8/
	Change Log:
	- Removed the dependancy to jQuery
	- Integrated into TypeScript class
	- Converted to busted Javascript (this was I, needleful)
*/
class Editor {
	text;
	enabled = true;
	keydown = (evt) => {
		this.text = evt.target;
		switch(evt.key) {
		case "Escape":
			evt.preventDefault();
			this.enabled = !this.enabled;
			return false;
		case "Enter":
			//break;
			if (this.text.selectionStart == this.text.selectionEnd) {
				// find start of the current line
				var sel = this.text.selectionStart;
				var text = this.text.value;
				while (sel > 0 && text[sel-1] != '\n') {
					sel--;
				}
				
				var lineStart = sel;
				while (text[sel] == ' ' || text[sel]=='\t')
				sel++;
				
				if (sel > lineStart) {
					evt.preventDefault();
					// Insert carriage return and indented text
					document.execCommand('insertText', false, "\n" + text.substr(lineStart, sel-lineStart));

					// Scroll caret visible
					this.text.blur();
					this.text.focus();
					return false;
				}
			}
			break;
		case "Tab":
			if(!this.enabled) break;
			evt.preventDefault();
			// selection?
			if (this.text.selectionStart == this.text.selectionEnd) {
				// These single character operations are undoable
				if (!evt.shiftKey) {
					document.execCommand('insertText', false, "\t");
				}
				else {
					var text = this.text.value;
					if (this.text.selectionStart > 0 && text[this.text.selectionStart-1]=='\t') {
						document.execCommand('delete');
					}
				}
			}
			else {
				// Block indent/unindent trashes undo stack.
				// Select whole lines
				var selStart = this.text.selectionStart;
				var selEnd = this.text.selectionEnd;
				var text = this.text.value;
				while (selStart > 0 && text[selStart-1] != '\n')
					selStart--;
				while (selEnd > 0 && text[selEnd-1]!='\n' && selEnd < text.length)
					selEnd++;

				// Get selected text
				let lines = text.substr(selStart, selEnd - selStart).split('\n');

				// Insert tabs
				for (var i=0; i<lines.length; i++) {
					// Don't indent last line if cursor at start of line
					if (i==lines.length-1 && lines[i].length==0)
						continue;

					// Tab or Shift+Tab?
					if (evt.shiftKey) {
						if (lines[i].startsWith('\t'))
							lines[i] = lines[i].substr(1);
						else if (lines[i].startsWith("    "))
							lines[i] = lines[i].substr(4);
					}
					else
						lines[i] = "\t" + lines[i];
				}
				let output = lines.join('\n');

				// Update the text area
				this.text.value = text.substr(0, selStart) + output + text.substr(selEnd);
				this.text.selectionStart = selStart;
				this.text.selectionEnd = selStart + output.length; 
			}
			return false;
		}
		return true;
	}
	constructor(textarea) {
		this.text = textarea;
		this.text.addEventListener("keydown", this.keydown.bind(this));
	}
}
let editor = new Editor(document.getElementById("editor-text"));

// Now my code for compiling and running
let npa_results = {};

function compileAndRun() {
	let text = editor.text.value;
	let results = document.getElementById('status');

	function clearMessages() {
		results.innerHTML = '';
	}
	function print(message, properties) {
		let p1 = makeChild(results, "p", properties);
		p1.innerText = message;
	}
	const centered = {style: 'text-align:center;'}

	clearMessages();
	print("Compiling...");
	try {
		npa_results = {};
		npa_results.parseTree = parseAlgol(text, {multiWordIdents:true});
	}
	catch(error) {
		console.error(error);
		print(`${error.text} at line ${error.location.line}, column ${error.location.column}.`);
		throw error;
	}
	try {
		npa_results.ir = analyze(text, npa_results.parseTree);
		npa_results.readableIr = {};
		for(p in npa_results.ir) {
			let proc = npa_results.ir[p];
			if(proc.inline) {
				npa_results.readableIr[p] = {inline: wasmInstrNames[proc.inline]};
			}
			else if(proc.code) {
				npa_results.readableIr[p] = {code: ir_almost_pretty_print(proc.code, 0)};
			}
			else if('import' in proc) {
				npa_results.readableIr[p] = {import: proc.import};
			}
		}
	}
	catch(error) {
		console.error(error);
		print("Analysis failed with error: "+ error);
		throw error;
	}
	try {
		npa_results.test_mod = ir_to_assembler(npa_results.ir);
		[npa_results.bytes, npa_results.wasmCode] = assemble(npa_results.test_mod);
	}
	catch(error) {
		console.error(error);
		console.log('Assembly failed with error', error);
		throw error;
	}
	let wasm_platform = {
		io:{
			outinteger: (c,e) => print(e),
			outreal: (c, r) => print(r),
			outboolean: (c, b) => print(Boolean(b))
		}
	}
	WebAssembly.instantiate(npa_results.bytes, wasm_platform)
	.then(result => {
		npa_results.wasm = result;
		let main = npa_results.wasm.instance.exports["#main#"];
		print('-----', centered);
		main();
		print('---Program end---', centered);
	})
	.catch(error => {
		console.error(error);
		print(`Error while compiling/running (probably a compiler bug): ${error}`);
	});
}