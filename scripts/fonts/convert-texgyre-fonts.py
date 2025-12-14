import os
import io
import binascii
from fontTools.ttLib import TTFont
from fontTools import subset
dirname = os.path.dirname(__file__)

# TexGyre fonts batch converted with otf2ttf.py from fonttools
# https://github.com/fonttools/fonttools/blob/d584daa8fdc71030f92ee665472d6c7cddd49283/Snippets/otf2ttf.py

PS_TO_FILENAME = {
    "TG-Heros":             "texgyreheros-regular.ttf",
    "TG-Heros-Bold":        "texgyreheros-bold.ttf",
    "TG-Heros-Oblique":     "texgyreheros-italic.ttf",
    "TG-Heros-BoldOblique": "texgyreheros-bolditalic.ttf",

    "TG-Heros-Narrow":             "texgyreheroscn-regular.ttf",
    "TG-Heros-Narrow-Bold":        "texgyreheroscn-bold.ttf",
    "TG-Heros-Narrow-Oblique":     "texgyreheroscn-italic.ttf",
    "TG-Heros-Narrow-BoldOblique": "texgyreheroscn-bolditalic.ttf",

    "TG-Termes":             "texgyretermes-regular.ttf",
    "TG-Termes-Bold":        "texgyretermes-bold.ttf",
    "TG-Termes-Italic":      "texgyretermes-italic.ttf",
    "TG-Termes-BoldItalic":  "texgyretermes-bolditalic.ttf",

    "TG-Cursor":             "texgyrecursor-regular.ttf",
    "TG-Cursor-Bold":        "texgyrecursor-bold.ttf",
    "TG-Cursor-Oblique":     "texgyrecursor-italic.ttf",
    "TG-Cursor-BoldOblique": "texgyrecursor-bolditalic.ttf",

    "TG-Adventor":             "texgyreadventor-regular.ttf",
    "TG-Adventor-Bold":        "texgyreadventor-bold.ttf",
    "TG-Adventor-Oblique":     "texgyreadventor-italic.ttf",
    "TG-Adventor-BoldOblique": "texgyreadventor-bolditalic.ttf",

    "TG-Bonum":             "texgyrebonum-regular.ttf",
    "TG-Bonum-Bold":        "texgyrebonum-bold.ttf",
    "TG-Bonum-Oblique":     "texgyrebonum-italic.ttf",
    "TG-Bonum-BoldOblique": "texgyrebonum-bolditalic.ttf",

    "TG-Schola":             "texgyreschola-regular.ttf",
    "TG-Schola-Bold":        "texgyreschola-bold.ttf",
    "TG-Schola-Oblique":     "texgyreschola-italic.ttf",
    "TG-Schola-BoldOblique": "texgyreschola-bolditalic.ttf",

    "TG-Pagella":             "texgyrepagella-regular.ttf",
    "TG-Pagella-Bold":        "texgyrepagella-bold.ttf",
    "TG-Pagella-Oblique":     "texgyrepagella-italic.ttf",
    "TG-Pagella-BoldOblique": "texgyrepagella-bolditalic.ttf",

    "TG-Chorus": "texgyrechorus-mediumitalic.ttf",
}

STD_ENC_MAP = {
    "space": 0x0020, "exclam": 0x0021, "quotedbl": 0x0022, "numbersign": 0x0023,
    "dollar": 0x0024, "percent": 0x0025, "ampersand": 0x0026, "quoteright": 0x0027,
    "parenleft": 0x0028, "parenright": 0x0029, "asterisk": 0x002A, "plus": 0x002B,
    "comma": 0x002C, "hyphen": 0x002D, "period": 0x002E, "slash": 0x002F,
    "colon": 0x003A, "semicolon": 0x003B, "less": 0x003C, "equal": 0x003D,
    "greater": 0x003E, "question": 0x003F, "at": 0x0040, "bracketleft": 0x005B,
    "backslash": 0x005C, "bracketright": 0x005D, "asciicircum": 0x005E,
    "underscore": 0x005F, "quoteleft": 0x0060, "braceleft": 0x007B, "bar": 0x007C,
    "braceright": 0x007D, "asciitilde": 0x007E,

    "exclamdown": 0x00A1, "cent": 0x00A2, "sterling": 0x00A3, "fraction": 0x2044,
    "yen": 0x00A5, "florin": 0x0192, "section": 0x00A7, "currency": 0x00A4,
    "quotesingle": 0x0027, "quotedblleft": 0x201C, "guillemotleft": 0x00AB,
    "guilsinglleft": 0x2039, "guilsinglright": 0x203A, "fi": 0xFB01, "fl": 0xFB02,
    "endash": 0x2013, "dagger": 0x2020, "daggerdbl": 0x2021, "periodcentered": 0x00B7,
    "paragraph": 0x00B6, "bullet": 0x2022, "quotesinglbase": 0x201A,
    "quotedblbase": 0x201E, "quotedblright": 0x201D, "guillemotright": 0x00BB,
    "ellipsis": 0x2026, "perthousand": 0x2030, "questiondown": 0x00BF, "grave": 0x0060,
    "acute": 0x00B4, "circumflex": 0x02C6, "tilde": 0x02DC, "macron": 0x00AF,
    "breve": 0x02D8, "dotaccent": 0x02D9, "dieresis": 0x00A8, "ring": 0x02DA,
    "cedilla": 0x00B8, "hungarumlaut": 0x02DD, "ogonek": 0x02DB, "caron": 0x02C7,
    "emdash": 0x2014, "AE": 0x00C6, "ordfeminine": 0x00AA, "Lslash": 0x0141,
    "Oslash": 0x00D8, "OE": 0x0152, "ordmasculine": 0x00BA, "ae": 0x00E6,
    "dotlessi": 0x0131, "lslash": 0x0142, "oslash": 0x00F8, "oe": 0x0153,
    "germandbls": 0x00DF, "minus": 0x2212
}

# Add A-Z, a-z, 0-9
for i in range(10):
    STD_ENC_MAP[["zero","one","two","three","four","five","six","seven","eight","nine"][i]] = 0x30 + i
for i in range(26): STD_ENC_MAP[chr(65+i)] = 65+i
for i in range(26): STD_ENC_MAP[chr(97+i)] = 97+i


def process_font_entry(ps_name, filename):
    source_file = os.path.join(dirname, "ttfs", filename)
    print(f"Generating {ps_name} from {source_file}...")

    if not os.path.exists(source_file):
        print(f"  [SKIPPED] File not found: {source_file}")
        return

    try:
        tt = TTFont(source_file)
    except Exception as e:
        print(f"  [ERROR] Could not load font: {e}")
        return

    options = subset.Options()
    options.drop_tables = [
        "DSIG", "FFTM", "GDEF", "GPOS", "GSUB", "LTSH", "VDMX", "hdmx",
        "kern", "vhea", "vmtx", "prep", "cvt ", "fpgm", "gasp",
        "name", "OS/2", "post"
    ]

    subsetter = subset.Subsetter(options=options)
    subsetter.populate(unicodes=STD_ENC_MAP.values())
    subsetter.subset(tt)

    cmap = tt.getBestCmap()
    charstrings = []

    for name, uni in STD_ENC_MAP.items():
        if uni in cmap:
            glyph_name = cmap[uni]
            gid = tt.getGlyphID(glyph_name)
            charstrings.append(f"/{name} {gid} def")

    buf = io.BytesIO()
    tt.save(buf)
    binary_data = buf.getvalue()

    out_name = os.path.join(dirname, "output", f"{ps_name}.ps")
    with open(out_name, "w") as f:
        f.write(f"% Derived from {filename.replace(".ttf", "")} which is licensed under the GUST Font License (GFL)\n")
        f.write(f"% The original TeXGyre fonts can be downloaded from https://www.gust.org.pl/projects/e-foundry/tex-gyre\n")
        f.write(f"% The license can be accessed at https://www.gust.org.pl/projects/e-foundry/licenses/GUST-FONT-LICENSE.txt/view\n\n")
        f.write("11 dict begin\n")
        f.write(f"  /FontName /{ps_name} def\n")
        f.write("  /FontType 42 def\n")

        f.write(f"  /FontMatrix [1 0 0 1 0 0] def\n")
        f.write("  /PaintType 0 def\n")
        f.write("  /Encoding StandardEncoding def\n")

        h = tt['head']
        f.write(f"  /FontBBox [{h.xMin} {h.yMin} {h.xMax} {h.yMax}] def\n")

        f.write(f"  /CharStrings {len(charstrings) + 5} dict dup begin\n")
        f.write("    /.notdef 0 def\n")
        c_count = 1
        for c in charstrings:
            f.write(f"    {c}")
            if c_count % 4 == 0: f.write("\n")
            else: f.write(" ")
            c_count += 1
        f.write("\n  end def\n")

        f.write("  /sfnts [\n")
        offset = 0
        CHUNK_SIZE = 32768
        while offset < len(binary_data):
            chunk = binary_data[offset : offset + CHUNK_SIZE]
            hex_str = binascii.hexlify(chunk).decode("ascii").upper()

            f.write("    <")
            hex_pos = 0
            while hex_pos < len(hex_str):
                segment = hex_str[hex_pos : hex_pos + 70]
                if hex_pos == 0: f.write(f"{segment}\n")
                else: f.write(f"      {segment}\n")
                hex_pos += 70
            f.write("    >\n")
            offset += CHUNK_SIZE
        f.write("  ] def\n")

        f.write(f"/{ps_name} currentdict end definefont pop\n")

    print(f"  -> Success: {out_name} written.")


if __name__ == "__main__":
    print(f"Starting conversion for {len(PS_TO_FILENAME)} fonts...")
    for ps_name, filename in PS_TO_FILENAME.items():
        process_font_entry(ps_name, filename)
    print("Batch processing complete.")