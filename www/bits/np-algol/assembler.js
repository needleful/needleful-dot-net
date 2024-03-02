// Section indeces
const M = {custom: 0, types: 1, imports: 2, funcs: 3, tables: 4, memories: 5, globals: 6, exports: 7, start: 8, elements: 9, code: 10, data: 11, data_count:12};
// Value types
const T = {
	i32: 0x7f, i64: 0x7e, f32: 0x7d, f64: 0x7c, v128: 0x7b,
	funcref: 0x70, externref: 0x6f, func: 0x60, block: 0x40
};
// Export types
const E = {func: 0, table: 1, mem: 2, global: 3};
// Instruction codes
const I = {
	unreachable: 0x0, nop: 0x1, block: 0x2, loop: 0x3, if: 0x4, else: 0x5, 
	end: 0xb, br: 0xc, br_if: 0xd, br_table: 0xe, return: 0xf, call: 0x10, call_indirect: 0x11,
	refnull: 0xd0, isnull: 0xd1, funcref: 0xd2,
	drop: 0x1a, select:0x1b, tselect: 0x1c,
	lget: 0x20, lset: 0x21, ltee: 0x22, gget: 0x23, gset: 0x24, tget: 0x25, tset: 0x26,
	tinit: [0xfc, 12], edrop: [0xfc, 13], tcopy: [0xfc, 14], tgrow: [0xfc, 15], tsize: [0xfc, 16], tfill: [0xfc, 17],
	i32load: 0x28, i64load: 0x29, f32load: 0x2a, f64load: 0x2b, 
	i32load8_s: 0x2c, i32load8_u: 0x2d, i32load16_s: 0x2e, i32load16_u: 0x2f, 
	i64load8_s: 0x30, i64load8_u: 0x32, i64load16_s: 0x32, i64load16_u: 0x33, i64load32_s: 0x34, i64load32_u: 0x35,
	i32store: 0x36, i64store: 0x37, f32store: 0x38, f64store: 0x39, i32store8: 0x3a, i32store16: 0x3b, i64store8: 0x3c, i64store16: 0x3d, i64store32: 0x3e,
    memsize: [0x3f, 0], memgrow: [0x40, 0], meminit_prefix: [0xfc, 8], meminit_suffix: 0x0, datadrop: [0xfc, 10], memcopy: [0xfc, 10, 0, 0], memfill: [0xfc, 11, 0],
	i32: 0x41, i64: 0x42, f32: 0x43, f64: 0x44,
	i32eqz: 0x45, i32eq: 0x46, i32ne: 0x47, i32lt_s: 0x48, i32lt_u: 0x49, i32gt_s: 0x4a, i32gt_u: 0x4b, i32le_s: 0x4c, i32le_u: 0x4d, i32ge_s: 0x4e, i32ge_u: 0x4f,
	i64eqz: 0x50, i64eq: 0x51, i64ne: 0x52, i64lt_s: 0x53, i64lt_u: 0x54, i64gt_s: 0x55, i64gt_u: 0x56, i64le_s: 0x57, i64le_u: 0x58, i64ge_s: 0x59, i64ge_u: 0x5a,
	f32eq: 0x5b, f32ne: 0x5c, f32lt: 0x5d, f32gt: 0x5e, f32le: 0x5f, f32ge: 0x60,
	f64eq: 0x61, f64ne: 0x62, f64lt: 0x63, f64gt: 0x64, f64le: 0x65, f64ge: 0x66,
    i32clz: 0x67, i32ctz: 0x68, i32popcnt: 0x69, i32add: 0x6a, i32sub: 0x6b, i32mul: 0x6c, i32div_s: 0x6d, i32div_u: 0x6e, i32rem_s: 0x6f, i32rem_u: 0x70, i32and: 0x71, i32or: 0x72, i32xor: 0x73, i32shl: 0x74, i32shr_s: 0x75, i32shr_u: 0x76, i32rotl: 0x77, i32rotr: 0x78,
    i64clz: 0x79, i64ctz: 0x7a, i64popcnt: 0x7b, i64add: 0x7c, i64sub:0x7d, i64mul:0x7e, i64div_s:0x7f, i64div_u:0x80, i64rem_s:0x81, i64rem_u:0x82, i64and:0x83, i64or:0x84, i64xor:0x85, i64shl:0x86, i64shr_s:0x87, i64shr_u:0x88, i64rotl:0x89, i64rotr:0x8a,
    f32abs:0x8b, f32neg:0x8c, f32ceil:0x8d, f32floor:0x8e, f32trunc:0x8f, f32nearest:0x90, f32sqrt:0x91, f32add:0x92, f32sub:0x93, f32mul:0x94, f32div:0x95, f32min:0x96, f32max:0x97, f32copysign:0x98,
    f64abs:0x99, f64neg:0x9a, f64ceil:0x9b, f64floor:0x9c, f64trunc:0x9d, f64nearest:0x9e, f64sqrt:0x9f, f64add:0xa0, f64sub:0xa1, f64mul:0xa2, f64div:0xa3, f64min:0xa4, f64max:0xa5, f64copysign:0xa6,
    i32wrapi64: 0xa7, i32truncf32_s: 0xa8, i32truncf32_u:0xa9, i32truncf64_s:0xaa, i32truncf64_u:0xab, i64extendi32_s:0xac, i64extendi32_u:0xad, i64truncf32_s:0xae, i64truncf32_u:0xaf, i64truncf64_s:0xb0, i64truncf64_u:0xb1,
    f32converti32_s:0xb2, f32converti32_u:0xb3, f32converti64_s:0xb4, f32converti64_u:0xb5, f32demotef64:0xb6, f64converti32_s:0xb6, f64converti32_u:0xb8, f64converti64_s:0xb9, f64converti64_u:0xba, f64promotef32:0xbb,
    i32reinterpretf32:0xbc, i64reinterpretf64:0xbd, f32reinterpreti32:0xbe, f64reinterpreti64:0xbf,
    i32extend8_s:0xc0, i32extend16_s:0xc1, i64extend8_s:0xc2, i64extend16_s:0xc3, i64extend32_s:0xc4,
    i32truncsatf32_s: [0xfc, 0], i32truncsatf32_u: [0xfc, 1], i32truncsatf64_s: [0xfc, 2], i32truncsatf64_u: [0xfc, 3], i64truncsatf32_s: [0xfc, 4], i64truncsatf32_u: [0xfc, 5], i64truncsatf64_s: [0xfc, 6], i64truncsatf64_u: [0xfc, 7],
    v128load: [0xfD, 0], v128load8x8_s: [0xfD, 1], v128load8x8_u: [0xfD, 2], v128load16x4_s: [0xfD, 3], v128load16x4_u: [0xfD, 4], v128load32x2_s: [0xfD, 5], v128load32x2_u: [0xfD, 6], v128load8_splat: [0xfD, 7], v128load16_splat: [0xfD, 8], v128load32_splat: [0xfD, 9], v128load64_splat: [0xfD, 10],
    v128store: [0xfD, 11], v128: [0xfD, 12], i8x16shuffle: [0xfD, 13],
    i8x16swizzle: [0xfD, 14], i8x16splat: [0xfD, 15], i16x8splat: [0xfD, 16], i32x4splat: [0xfD, 17], i64x2splat: [0xfD, 18], f32x4splat: [0xfD, 19], f64x2splat: [0xfD, 20],
    v128load32_zero: [0xfD, 92], v128load64_zero: [0xfD, 93],
    v128load8_lane: [0xfD, 84], v128load16_lane: [0xfD, 85], v128load32_lane: [0xfD, 86], v128load64_lane: [0xfD, 87], v128store8_lane: [0xfD, 88], v128store16_lane: [0xfD, 89], v128store32_lane: [0xfD, 90], v128store64_lane: [0xfD, 91],
    i8x16extract_lane_s: [0xfD, 21], i8x16extract_lane_u: [0xfD, 22], i8x16replace_lane: [0xfD, 23],
    i16x8extract_lane_s: [0xfD, 24], i16x8extract_lane_u: [0xfD, 25], i16x8replace_lane: [0xfD, 26],
    i32x4extract_lane: [0xfD, 27], i32x4replace_lane: [0xfD, 28], i64x2extract_lane: [0xfD, 29], i64x2replace_lane: [0xfD, 30],
    f32x4extract_lane: [0xfD, 31], f32x4replace_lane: [0xfD, 32], f64x2extract_lane: [0xfD, 33], f64x2replace_lane: [0xfD, 34],
    i8x16eq: [0xfD, 35], i8x16ne: [0xfD, 36], i8x16lt_s: [0xfD, 37], i8x16lt_u: [0xfD, 38], i8x16gt_s: [0xfD, 39], i8x16gt_u: [0xfD, 40], i8x16le_s: [0xfD, 41], i8x16le_u: [0xfD, 42], i8x16ge_s: [0xfD, 43], i8x16ge_u: [0xfD, 44],
    i16x8eq: [0xfD, 45], i16x8ne: [0xfD, 46], i16x8lt_s: [0xfD, 47], i16x8lt_u: [0xfD, 48], i16x8gt_s: [0xfD, 49], i16x8gt_u: [0xfD, 50], i16x8le_s: [0xfD, 51], i16x8le_u: [0xfD, 52], i16x8ge_s: [0xfD, 53], i16x8ge_u: [0xfD, 54],
    i32x4eq: [0xfD, 55], i32x4ne: [0xfD, 56], i32x4lt_s: [0xfD, 57], i32x4lt_u: [0xfD, 58], i32x4gt_s: [0xfD, 59], i32x4gt_u: [0xfD, 60], i32x4le_s: [0xfD, 61], i32x4le_u: [0xfD, 62], i32x4ge_s: [0xfD, 63], i32x4ge_u: [0xfD, 64],
    i64x2eq: [0xfD, 214], i64x2ne: [0xfD, 215], i64x2lt_s: [0xfD, 216], i64x2gt_s: [0xfD, 217], i64x2le_s: [0xfD, 218], i64x2ge_s: [0xfD, 219],
    f32x4eq: [0xfD, 65], f32x4ne: [0xfD, 66], f32x4lt: [0xfD, 67], f32x4gt: [0xfD, 68], f32x4le: [0xfD, 69], f32x4ge: [0xfD, 70],
    f64x2eq: [0xfD, 71], f64x2ne: [0xfD, 72], f64x2lt: [0xfD, 73], f64x2gt: [0xfD, 74], f64x2le: [0xfD, 75], f64x2ge: [0xfD, 76],
    v128not: [0xfD, 77], v128and: [0xfD, 78], v128andnot: [0xfD, 79], v128or: [0xfD, 80], v128xor: [0xfD, 81], v128bitselect: [0xfD, 82], v128any_true: [0xfD, 83],
    i8x16abs: [0xfD, 96],i8x16neg: [0xfD, 97],i8x16popcnt: [0xfD, 98],i8x16all_true: [0xfD, 99],i8x16bitmask: [0xfD, 100],i8x16narrow_i16x8_s: [0xfD, 101],i8x16narrow_i16x8_u: [0xfD, 102],
    i8x16shl: [0xfD, 107],i8x16shr_s: [0xfD, 108],i8x16shr_u: [0xfD, 109],i8x16add: [0xfD, 110], i8x16add_sat_s: [0xfD, 111],i8x16add_sat_u: [0xfD, 112],i8x16sub: [0xfD, 113],i8x16sub_sat_s: [0xfD, 114],i8x16sub_sat_u: [0xfD, 115],
    i8x16min_s: [0xfD, 118],i8x16min_u: [0xfD, 119],i8x16max_s: [0xfD, 120],i8x16max_u: [0xfD, 121],
    i8x16avgr_u: [0xfD, 123],
    i16x8extadd_pairwise_i8x16_s: [0xfD, 124],i16x8extadd_pairwise_i8x16_u: [0xfD, 125],
    i16x8abs: [0xfD, 128],i16x8neg: [0xfD, 129],i16x8q15mulr_sat_s: [0xfD, 130],i16x8all_true: [0xfD, 131],i16x8bitmask: [0xfD, 132],i16x8narrow_i32x4_s: [0xfD, 133],i16x8narrow_i32x4_u: [0xfD, 134],i16x8extend_low_8x16_s: [0xfD, 135],i16x8extend_high_8x16_s: [0xfD, 136],i16x8extend_low_8x16_u: [0xfD, 137],i16x8extend_high_8x16_u: [0xfD, 138],i16x8shl: [0xfD, 139],i16x8shr_s: [0xfD, 140],i16x8shr_u: [0xfD, 141],i16x8add: [0xfD, 142],i16x8add_sat_s: [0xfD, 143],i16x8add_sat_u: [0xfD, 144],i16x8sub: [0xfD, 145],i16x8sub_sat_s: [0xfD, 146],i16x8sub_sat_u: [0xfD, 147],i16x8mul: [0xfD, 148],i16x8min_s: [0xfD, 149],i16x8min_u: [0xfD, 150],i16x8max_s: [0xfD, 151],i16x8max_u: [0xfD, 152],
    i16x8avgr_u: [0xfD, 155],i16x8extmul_low_i8x16_s: [0xfD, 156],i16x8extmul_high_i8x16_s: [0xfD, 157],i16x8extmul_low_i8x16_u: [0xfD, 158],i16x8extmul_high_i8x16_u: [0xfD, 159],
    i32x4extadd_pairwise_i16x8_s: [0xfD, 126],i32x4extadd_pairwise_i16x8_u: [0xfD, 127],
    i32x4abs: [0xfD, 160],i32x4neg: [0xfD, 161],
    i32x4all_true: [0xfD, 163],i32x4bitmask: [0xfD, 164],
    i32x4extend_low_i16x8_s: [0xfD, 167],i32x4extend_high_i16x8_s: [0xfD, 168],i32x4extend_low_i16x8_u: [0xfD, 169],i32x4extend_high_i16x8_u: [0xfD, 170],i32x4shl: [0xfD, 171],i32x4shr_s: [0xfD, 172],i32x4shr_u: [0xfD, 173],i32x4add: [0xfD, 174],
    i32x4sub: [0xfD, 177],
    i32x4mul: [0xfD, 181],i32x4min_s: [0xfD, 182],i32x4min_u: [0xfD, 183],i32x4max_s: [0xfD, 184],i32x4max_u: [0xfD, 185],i32x4dot_i16x8_s: [0xfD, 186],
    i32x4extmul_low_i16x8_s: [0xfD, 188],i32x4extmul_high_i16x8_s: [0xfD, 189],i32x4extmul_low_i16x8_u: [0xfD, 190],i32x4extmul_high_i16x8_u: [0xfD, 191],
    i64x2abs: [0xfD, 192],i64x2neg: [0xfD, 193],
    i64x2all_true: [0xfD, 195],i64x2bitmask: [0xfD, 196],
    i64x2extend_low_i32x4_s: [0xfD, 199],i64x2extend_high_i32x4_s: [0xfD, 200],i64x2extend_low_i32x4_u: [0xfD, 201],i64x2extend_high_i32x4_u: [0xfD, 202],i64x2shl: [0xfD, 203],i64x2shr_s: [0xfD, 204],i64x2shr_u: [0xfD, 205],i64x2add: [0xfD, 206],
    i64x2sub: [0xfD, 209],
    i64x2mul: [0xfD, 213],
    i64x2extmul_low_i32x4_s: [0xfD, 220],i64x2extmul_high_i32x4_s: [0xfD, 221],i64x2extmul_low_i32x4_u: [0xfD, 222],i64x2extmul_high_i32x4_u: [0xfD, 223],
    f32x4ceil: [0xfD, 103],f32x4floor: [0xfD, 104],f32x4trunc: [0xfD, 105],f32x4nearest: [0xfD, 106],
    f32x4abs: [0xfD, 224],f32x4neg: [0xfD, 225],
    f32x4sqrt: [0xfD, 227],f32x4add: [0xfD, 228],f32x4sub: [0xfD, 229],f32x4mul: [0xfD, 230],f32x4div: [0xfD, 231],f32x4min: [0xfD, 232],f32x4max: [0xfD, 233],f32x4pmin: [0xfD, 234],f32x4pmax: [0xfD, 235],
    f64x2ceil: [0xfD, 116],f64x2floor: [0xfD, 117],
    f64x2trunc: [0xfD, 122],
    f64x2nearest: [0xfD, 148],
    f64x2abs: [0xfD, 236],f64x2neg: [0xfD, 237],
    f64x2sqrt: [0xfD, 239],f64x2add: [0xfD, 240],f64x2sub: [0xfD, 241],f64x2mul: [0xfD, 242],f64x2div: [0xfD, 243],f64x2min: [0xfD, 244],f64x2max: [0xfD, 245],f64x2pmin: [0xfD, 246],f64x2pmax: [0xfD, 247],
    i32x4trunc_sat_f32x4_s: [0xfD, 248],i32x4trunc_sat_f32x4_u: [0xfD, 249],i32x4convert_f32x4_s: [0xfD, 250],i32x4convert_f32x4_u: [0xfD, 251],i32x4trunc_sat_f64x2_s_zero: [0xfD, 252],i32x4trunc_sat_f64x2_u_zero: [0xfD, 253],i64x2convert_low_i32x4_s: [0xfD, 254],i64x2convert_low_i32x4_u: [0xfD, 255],
    f32x4demote_f64x2_zero: [0xfD, 94], f64x2promote_low_f32x4: [0xfD, 95]
};

// Pretty sure this works for signed and unsigned.
function leb(array, value) {
	value |= 0;
	do {
		let little = value & 127;
		if(value >= 127 || value <= -128) {
			little |= 128;
		}
		if(value < 0 && value > -128) {
			little |= 64;
		}
		array.push(little);
		value /= 128;
		value |= 0;
		// Encoding 127
		if(value == 0 && little == 255) {
			array.push(0);
		}
	} while(Math.abs(value) > 0);
}

function leb_const(value) {
	let r = [];
	leb(r, value);
	return r;
}

function f32_const(value) {
	let b = new ArrayBuffer(4);
	let f = new Float32Array(b);
	f[0] = value;
	let u = new Uint8Array(b);
	return Array.from(u);
}

function f64_const(value) {
	let b = new ArrayBuffer(8);
	let f = new Float64Array(b);
	f[0] = value;
	let u = new Uint8Array(b);
	return Array.from(u);
}

function vector(array, list) {
	if (!Array.isArray(list)) {
		array.push(1);
		array.push(list);
		return array;
	}
	leb(array, list.length);
	return array.concat(list);
}

function vector_const(list) {
	let t = [];
	vector(t, list);
	return t;
}

function name(array, string) {
	let bytes = (new TextEncoder()).encode(string);
	return vector(array, Array.from(bytes));
}

function assemble(descriptor) {
	let r = []; // Dynamic array
	for(let section of descriptor) {
		if(!Array.isArray(section)) {
			console.log("Not an array: ", section);
			continue;
		}
		let type = section.shift();
		r.push(type);
		switch(type) {
		case M.custom: {
			// Assume it's an array of bytes from who-knows-where
			r = vector(r, section);
		} break;
		case M.types:{
			let t = [];
			leb(t, section.length);
			for(let f of section) {
				t.push(T.func);
				t = vector(t, f[0]);
				t = vector(t, f[1]);
			}
			r = vector(r, t);
		} break;
		case M.imports:
			break;
		case M.funcs: {
			let t = [];
			leb(t, section.length);
			for(let idx of section) {
				leb(t, idx);
			}
			r = vector(r, t);
		} break;
		case M.tables:
			break;
		case M.memories:
			break;
		case M.globals:
			break;
		case M.exports: {
			let t = [];
			leb(t, section.length);
			for(let e of section) {
				t = name(t, e[0]);
				t.push(e[1]);
				leb(t, e[2]);
			}
			r = vector(r, t);
		} break;
		case M.start:
			break;
		case M.elements:
			break;
		case M.code: {
			let t = [];
			leb(t, section.length);
			for(let f of section) {
				let fn = [];
				leb(fn, f[0].length);
				for(let loc of f[0]) {
					leb(fn, loc[0]);
					fn.push(loc[1]);
				}
				fn = fn.concat(f[1].flat());
				fn.push(I.end);
				t = vector(t, fn);
			}
			r = vector(r, t);
		} break;
		case M.data:
			break;
		case M.data_count:
			break;
		}
	}
	let bytes = new Uint8Array(r.length + 8);
	bytes.set([0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00]);
	bytes.set(r, 8);
	return bytes;
}