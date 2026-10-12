"""Shared look for every plot in this paper.

Each figure script does:

    import style
    fig, ax = style.figure()            # or style.figure(full_width=True)
    ...
    style.save(fig, "name")             # writes name.pdf next to the script
"""
from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt

# Widths in inches. Defaults fit the generic 11pt article wrapper; the
# `figures` mode replaces them with the venue template's measured values.
COLUMN_WIDTH_IN = 4.98
TEXT_WIDTH_IN = 4.98
ASPECT = 0.62  # height / width

# Okabe-Ito palette: distinguishable under the common colour-vision deficiencies.
PALETTE = [
    "#0072B2",  # blue
    "#D55E00",  # vermillion
    "#009E73",  # bluish green
    "#E69F00",  # orange
    "#CC79A7",  # reddish purple
    "#56B4E9",  # sky blue
    "#000000",  # black
]
MARKERS = ["o", "s", "^", "D", "v", "P", "X"]
LINESTYLES = ["-", "--", "-.", ":"]

# One colour per method for the whole paper. Add a method the first time it is
# plotted, with the name fixed in brief.md, and never change it afterwards.
METHOD_COLORS = {}

plt.rcParams.update({
    "font.family": "serif",
    "font.size": 8,
    "axes.labelsize": 8,
    "axes.titlesize": 8,
    "xtick.labelsize": 7,
    "ytick.labelsize": 7,
    "legend.fontsize": 7,
    "axes.spines.top": False,
    "axes.spines.right": False,
    "axes.linewidth": 0.6,
    "axes.prop_cycle": matplotlib.cycler(color=PALETTE),
    "lines.linewidth": 1.2,
    "lines.markersize": 4,
    "grid.linewidth": 0.4,
    "grid.alpha": 0.4,
    "legend.frameon": False,
    "pdf.fonttype": 42,  # embed TrueType, not Type 3: required by most venues
    "ps.fonttype": 42,
    "savefig.bbox": "tight",
    "savefig.pad_inches": 0.02,
})


def figure(full_width=False, aspect=ASPECT, nrows=1, ncols=1, **kwargs):
    """A figure sized for one column, or for the full text width."""
    width = TEXT_WIDTH_IN if full_width else COLUMN_WIDTH_IN
    return plt.subplots(nrows, ncols, figsize=(width, width * aspect), **kwargs)


def color(method):
    """The paper-wide colour of a method; raises if it was never registered."""
    if method not in METHOD_COLORS:
        raise KeyError(
            f"{method!r} has no colour yet: add it to METHOD_COLORS in style.py"
        )
    return METHOD_COLORS[method]


def marker(index):
    return MARKERS[index % len(MARKERS)]


def linestyle(index):
    return LINESTYLES[index % len(LINESTYLES)]


def save(fig, name):
    """Write name.pdf next to the calling scripts."""
    out = Path(__file__).parent / f"{name}.pdf"
    fig.savefig(out)
    plt.close(fig)
    print(f"wrote {out}")
