:- module(templates, [
	template/3,
	load_templates/1
	]).

:- use_module(library(lists)).
:- use_module(library(pprint)).
:- use_module(library(sgml)).

% template(Name, Parameters, Content).
% Parameters defined as [(PName, (PType, Required))|Tail]
% PType can be text, integer, float, file, xml, or list(Param), which is recursive
:- dynamic(template/3).

load_templates(SourceDir) :-
	working_directory(CWD, SourceDir),
	expand_file_name('*.template.xml', TFiles),
	process_templates(TFiles),
	working_directory(_, CWD).

process_templates([]).
process_templates([A|T]) :- 
	(	load_xml(A, XML, [space(remove)]),
		read_template_xml(XML)
		; writeln('Failed to parse file':A)),
	process_templates(T).

read_template_xml([element(templates, _, Content)]) :- 
	maplist(read_template_xml, Content).
read_template_xml([element(template, [name = TMPName], Content)]) :-
	h_read_template(Content, template(TMPName, [], []), Template),
	print_term(Template, [indent_arguments(3)]),
	assert(Template).

h_read_template([], T, T).
h_read_template([element(param, Attributes, PC)|Tail], template(TName, Params, Content), Template) :-
	process_param(Attributes, PC, Param),
	h_read_template(Tail, template(TName, [Param|Params], Content), Template).
h_read_template([element(content, _, Content)|Tail], template(TName, P, []), Template) :-
	h_read_template(Tail, template(TName, P, Content), Template).

process_param(Attributes, Content, Param) :-
	h_process_param_attr(Attributes, ('', ('', true)), P),
	valid_param(P),
	(Name, (Type, Req)) = P,
	(	(	Type = list,
			Content = [element(param, Atr2, C2)],
			process_param(Atr2, C2, P2),
			Type2 = list(P2),
			Param = (Name, (Type2, Req)))
		;(	Content = [],
			Param = P)).

h_process_param_attr([], P, P).
h_process_param_attr([name=N|List], ('', (T, R)), Param) :- 
	h_process_param_attr(List, (N, (T, R)), Param).
h_process_param_attr([type=T|List], (N, ('', R)), Param) :-
	h_process_param_attr(List, (N, (T, R)), Param).
h_process_param_attr([required=R|List], (N, (T, true)), Param) :-
	h_process_param_attr(List, (N, (T, R)), Param).

valid_param((PN, (PT, PR))) :-
	(	member(PT, [text, xml, integer, file, float, list]),
		member(PR, [true, false]))
	;(	writeln('Invalid parameter'(PN, (PT, PR))),
		fail).