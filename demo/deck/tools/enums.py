"""Dump selected PowerPoint/Office enum constants from the installed type libraries (no app start)."""
import pythoncom, glob, re, sys
paths = glob.glob(r"C:\Program Files\Microsoft Office\root\Office16\MSPPT.OLB") + glob.glob(r"C:\Program Files\Microsoft Office\root\Office16\POWERPNT.EXE")
paths += glob.glob(r"C:\Program Files\Common Files\microsoft shared\OFFICE16\MSO.DLL")
pat = re.compile(sys.argv[1]) if len(sys.argv) > 1 else re.compile(r"Morph|msoAnimEffect(Fade|Appear|Wipe|Zoom|Float|MediaPlay|Transparency|ChangeFontColor|Darken|Lighten|Desaturate|GrowShrink|Grow|Ascend|Rise|FadedZoom|Dissolve)\b|msoAnimTrigger|msoAnimDirection(Left|Right|Up|Down)\b|msoAnimateText|msoAnimateLevel|ppEffectFadeSmoothly|msoAnimEffectFade$")
for p in paths:
    try:
        tl = pythoncom.LoadTypeLib(p)
    except Exception as e:
        print("skip", p, e); continue
    print("##", p, tl.GetDocumentation(-1)[0])
    for i in range(tl.GetTypeInfoCount()):
        ti = tl.GetTypeInfo(i); attr = ti.GetTypeAttr()
        if attr.typekind != pythoncom.TKIND_ENUM: continue
        for j in range(attr.cVars):
            vd = ti.GetVarDesc(j); name = ti.GetNames(vd.memid)[0]
            if pat.search(name): print(f"{name} = {vd.value}")
