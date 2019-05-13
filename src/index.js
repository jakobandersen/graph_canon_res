"strict";

import $ from 'jquery';
import 'jquery-ui-bundle';
import * as d3 from "d3";
import * as extraSymbols from "d3-symbol-extra";
import GoldenLayout  from 'golden-layout';
import 'spectrum-colorpicker';
import 'spectrum-colorpicker/spectrum.css';

import './style.css'; // we need to have some style file in order for dependencies to be included


// this is based on d3-symbol-extra and d3-shape
let symbolMinus = {
  draw: function(context, size) {
    var r = Math.sqrt(size / 5) / 2;
    context.moveTo(-3 * r, -r);
    context.lineTo(3 * r, -r);
    context.lineTo(3 * r, r);
    context.lineTo(-3 * r, r);
    context.closePath();
  }
};
let symbolPipe = {
  draw: function(context, size) {
    var r = Math.sqrt(size / 5) / 2;
    context.moveTo(-r, -3 * r);
    context.lineTo(r, -3 * r);
    context.lineTo(r, 3 * r);
    context.lineTo(-r, 3 * r);
    context.closePath();
  }
};

let symbols = [ // for cycling through them
  'X', 'Minus', 'Pipe',
  'Circle', 'Diamond', 'Square', 'Star', 'Cross', 'Wye',
  'Triangle', 'TriangleDown', 'TriangleLeft', 'TriangleRight',
  'DiamondAlt', 'DiamondSquare', 'Pentagon'
];
let symbolMap = new Map(); // for looking up the drawing functions
symbolMap.set("Minus", symbolMinus);
symbolMap.set("Pipe", symbolPipe);
for(let s of ["Circle", "Cross", "Diamond", "Square", "Star", "Triangle", "Wye"])
  symbolMap.set(s, d3["symbol" + s]);
for(let [s, d] of Object.entries(extraSymbols))
  symbolMap.set(s.substring(6, s.length), d);
let getSymbol = s => {
  return symbolMap.get(s);
};


class PlotGroup {
  constructor(domParent) {
    this.domParent = domParent;

    this.cols = new Map();
    this.configStyle = new Map();
    this.shownConfigs = new Set();

    this.promise = d3.json("data/data.json").then(data => {
      this.data = data;
      this.pkgFromCol = {};
      for(let [pkg, cols] of Object.entries(data)) {
        for(let [col, configs] of Object.entries(cols)) {
          this.pkgFromCol[col] = pkg;
          for(let config of configs)
            this.configStyle.set(config.specifier, {});
        }
      }
      this.resetConfigStyle();

      this.divFigs = this.domParent.append("div");

      this.divPlots = this.domParent
        .append("div")
        .style("display", "inline-block")
        .style("width", "1250px")
        .style("vertical-align", "top");
      this.divControls = this.domParent
        .append("div")
        .style("display", "inline-block")
        .style("width", "350px")
        .style("vertical-align", "top");


      let divAddBoth = this.divControls.append("div");
      let add = (type, text) => {
        let div = divAddBoth.append("div");
        div
          .append("label")
          .attr("for", "add_" + type)
          .text("Add " + text + " plot:");
        let select = div.append("select")
          .attr("name", "add_" + type);
        select.on("change", () => {
          let col = select.property("value");
          if(col == "nil") return;
          this.addPlot(col, type);
        });
        select.append("option")
          .attr("value", "nil").text("");
        select
          .selectAll("optgroup")
          .data(d3.entries(data)).enter()
          .append("optgroup")
          .attr("label", d => { return d.key; })
          .selectAll("option")
          .data(d => { return d3.entries(d.value); }).enter()
          .append("option")
          .attr("value", d => { return d.key; })
          .text(d => { return d.key; });
      };
      add("benchmark", "timing");
      add("stats", "node count");

      this.divConfigs = this.divControls.append("div");
      this.redrawConfigs();

      this.divFigs.append("label")
        .style("padding-right", 5)
        .text("Shortcuts (they may take a while to load):")
      this.divFigs.append("button")
        .text("Clear")
        .on("click", () => {
          this.clear();
        });
      this.divFigs.append("button")
        .text("Figure 2")
        .on("click", () => {
          this.clear();
          this.resetConfigStyleFew();
          for(let col of ["mz-aug2", "cfi-rigid-d3", "usr", "tnn", "f-lex-reg", "f-lex-srg"])
            this.addPlot(col, "benchmark", false);
          for(let config of ["An", "As", "At", "Bliss",
            "J_bfs-exp_f_basic_pl_t_q",
            "J_bfs-exp_fl_basic_pl_t_q",
            "J_bfs-exp_flm_basic_pl_t_q",
            "J_dfs_f_basic_pl_t_q",
            "J_dfs_fl_basic_pl_t_q",
            "J_dfs_flm_basic_pl_t_q"
          ])
            this.addConfig(config, false);
          this.redrawConfigs();
          this.redrawPlots();
        });
      this.divFigs.append("button")
        .text("Figure 5")
        .on("click", () => {
          this.clear();
          this.resetConfigStyleBasSchr();
          this.addPlot("cmz", "benchmark", false);
          this.addPlot("cmz", "stats", false);
          this.addPlot("k", "benchmark", false);
          this.addPlot("k", "stats", false);
          this.addPlot("mz-aug", "benchmark", false);
          for(let config of ["An", "As", "At", "Bliss"])
            this.addConfig(config, false);
          for(let tree of ["bfs-exp", "dfs"])
            for(let tc of ["f", "fl", "flm"])
              for(let aut of ["basic", "schreier"])
                this.addConfig("J_" + tree + "_" + tc + "_" + aut + "_pl_t_q", false);
          this.redrawConfigs();
          this.redrawPlots();
        });
      this.divFigs.append("button")
        .text("CFI Rigid")
        .on("click", () => {
          this.clear();
          this.resetConfigStyleCFIRigid();
          for(let c of ["d3", "z3", "z2", "r2", "s2", "t2"])
            this.addPlot("cfi-rigid-" + c, "benchmark", false);
          for(let config of ["An", "As", "At", "Bliss"])
            this.addConfig(config, false);
          for(let tree of ["bfs-exp", "dfs"])
            for(let tc of ["f", "fl", "flm"])
              for(let pl of ["_pl", ""])
                for(let t of ["_t", ""])
                  for(let q of ["_q", ""])
                    this.addConfig("J_" + tree + "_" + tc + "_basic" + pl + t + q, false);
          this.redrawConfigs();
          this.redrawPlots();
        });
    })
  }

  clear() {
    let cols = [...this.cols];
    for(let colPair of cols) {
      let p = colPair[1];
      this.removePlot(p.pkg, p.col, p.type);
    }
    this.redrawConfigs();
  }

  then(f) {
    this.promise = this.promise.then(f);
  }

  resetConfigStyle() {
    for(let [config, style] of this.configStyle.entries()) {
      let symbol = "X";
      let colour = "black";
      if(config[0] == "A") {
        colour = "blue";
        switch(config[1]) {
          case 'n': symbol = "Cross"; break;
          case 's': symbol = "Minus"; break;
          case 't': symbol = 'Pipe'; break;
        }
      } else if(config[0] == 'B') {
        colour = "red";
        symbol = "Cross";
      }
      style.colour = colour;
      style.symbol = symbol;
    }
    this.resetConfigStyleFew();
  }

  resetConfigStyleFew() {
    let styles = {
      "J_bfs-exp_f_basic_pl_t_q": {colour: "brown", symbol: "Cross"},
      "J_bfs-exp_fl_basic_pl_t_q": {colour: "purple", symbol: "X"},
      "J_bfs-exp_flm_basic_pl_t_q": {colour: "teal", symbol: "Square"},
      "J_dfs_f_basic_pl_t_q": {colour: "black", symbol: "Circle"},
      "J_dfs_fl_basic_pl_t_q": {colour: "orange", symbol: "Diamond"},
      "J_dfs_flm_basic_pl_t_q": {colour: "green", symbol: "Wye"}
    }
    for(let [config, style] of this.configStyle.entries()) {
      let s = styles[config];
      if(s) {
        style.colour = s.colour;
        style.symbol = s.symbol;
      }
    }
  }

  resetConfigStyleBasSchr() {
    let style = {
      "bfs-exp_f": {colour: "brown", basic: "Cross", schreier: "X"},
      "bfs-exp_fl": {colour: "purple", basic: "Minus", schreier: "Pipe"},
      "bfs-exp_flm": {colour: "teal", basic: "Square", schreier: "Diamond"},
      "dfs_f": {colour: "black", basic: "Circle", schreier: "Star"},
      "dfs_fl": {colour: "orange", basic: "Wye", schreier: "DiamondSquare"},
      "dfs_flm": {colour: "green", basic: "Triangle", schreier: "TriangleDown"}
    };
    for(let tree of ["bfs-exp", "dfs"]) {
      for(let tc of ["f", "fl", "flm"]) {
        let s = style[tree + "_" + tc];
        for(let aut of ["basic", "schreier"]) {
          let specifier = "J_" + tree + "_" + tc + "_" + aut + "_pl_t_q";
          let style = this.configStyle.get(specifier);
          style.colour = s.colour;
          style.symbol = s[aut];
        }
      }
    }
  }

  resetConfigStyleCFIRigid() {
    let colour = {
      "bfs-exp_f": "brown",
      "bfs-exp_fl": "purple",
      "bfs-exp_flm": "teal",
      "dfs_f": "black",
      "dfs_fl": "orange",
      "dfs_flm": "green"
    };
    for(let tree of ["bfs-exp", "dfs"]) {
      for(let tc of ["f", "fl", "flm"]) {
        let c = colour[tree + "_" + tc];
        let si = 0;
        for(let pl of ["_pl", ""]) {
          for(let t of ["_t", ""]) {
            for(let q of ["_q", ""]) {
              let specifier = "J_" + tree + "_" + tc + "_basic" + pl + t + q;
              let style = this.configStyle.get(specifier);
              style.colour = c;
              style.symbol = symbols[si];
              ++si;
            }
          }
        }
      }
    }
  }

  addPlot(col, type, redraw=true) {
    let pkg = this.pkgFromCol[col];
    let plot = new Plot(this, this.divPlots, pkg, col, type);
    this.cols.set({"col": col, "type": type}, plot);
    for(let specifier of this.shownConfigs) {
      plot.loadData(specifier, redraw);
    }
    if(redraw)
      this.redrawConfigs();
  }

  removePlot(pkg, col, type) {
    // Apparently there is no way to actually look up a specific object in a Map
    // because objects are compared by address.
    let res = (() => {
      for(let [key, plot] of this.cols)
        if(key.col == col && key.type == type)
          return [key, plot];
    })();
    res[1].container.remove();
    this.cols.delete(res[0]);
  }

  addConfig(specifier, redraw=true) {
    this.shownConfigs.add(specifier);
    for(let [col, plot] of this.cols)
      plot.loadData(specifier, redraw);
  }

  removeConfig(specifier) {
    this.shownConfigs.delete(specifier);
    for(let [col, plot] of this.cols)
      plot.removeData(specifier);
  }

  redrawConfigs() {
    this.divConfigs.selectAll("*").remove();
    this.divConfigs.append("label").text("Algorithm Configurations");
    // find which configurations are relevant for the current set of collections
    let configs = new Map();
    for(let [col, plot] of this.cols) {
      let pkg = this.pkgFromCol[col.col];
      for(let c of this.data[pkg][col.col])
        configs.set(c.specifier, c.name);
    }
    configs = [...configs.entries()].sort();
    for(let config of configs) {
      let specifier = config[0];
      let name = config[1];
      let divConfig = this.divConfigs.append("div");
      let enabled = divConfig
        .append("input");
      enabled
        .attr("type", "checkbox")
        .attr("name", specifier)
        .on("change", () => {
          if(enabled.property("checked")) {
            this.addConfig(specifier);
          } else {
            this.removeConfig(specifier);
          }
        });
      if(this.shownConfigs.has(specifier))
        enabled.attr("checked", true);
      // symbol
      let thisStyle = this.configStyle.get(specifier);
      let dd = divConfig.append("div").attr("class", "dropdown");
      let ddButton = dd.append("div")
        .attr("class", "dropdown-toggle");
      let selectedSvg = ddButton.append("svg")
        .attr('width', 30)
        .attr('height', 30);
      selectedSvg.append('path')
          .style("fill", "none")
          .style("stroke", "black")
          .style("stroke-width", 1.25)
          .attr('transform', 'translate(15, 15)')
          .attr('d', () => {
            return d3.symbol().size(100).type(getSymbol(thisStyle.symbol))();
          });
      ddButton.append("div").html("&#9660;");
      let ddList = dd.append("div")
        .attr("class", "dropdown-menu");
      for(let sym of symbols) {
        let symbol = d3.symbol().size(100).type(getSymbol(sym));
        let opt = ddList.append("div")
          .append("a")
          .attr("href", "#")
          .append("svg")
            .attr('width', 30)
            .attr('height', 30)
            .on("click", () => {
              thisStyle.symbol = sym;
              selectedSvg.select("path").remove();
              selectedSvg.append('path')
                .style("fill", "none")
                .style("stroke", "black")
                .style("stroke-width", 1.25)
                .attr('transform', 'translate(15, 15)')
                .attr('d', () => {
                  return symbol();
                });
              this.redrawPlots();
            })
            .append('path')
              .style("fill", "none")
              .style("stroke", "black")
              .style("stroke-width", 2)
              .attr('transform', 'translate(15, 15)')
              .attr('d', () => { return symbol(); });
      }
      ddButton.on("click", () => {
        ddList.node().classList.toggle("show");
      });
      // colour
      let id = "colourPicker_" + specifier;
      let colour = divConfig.append("input").attr("id", id);
      $("#" + "colourPicker_" + specifier).spectrum({
        showInput: true,
        showInitial: true,
        preferredFormat: "hex",
        showPalette: true,
        togglePaletteOnly: true,
        localStorageKey: "spectrum.configColour", // for saving selected colours
        palette: [["red", "green"], ["blue", "yellow"]],
        hideAfterPaletteSelect: true,
        maxSelectionSize: 10,
        color: thisStyle.colour,
        change:  (colour) => {
          thisStyle.colour = colour;
          this.redrawPlots();
        }
      });
      // label
      divConfig
        .append("label")
        .attr("for", specifier)
        .style("padding-left", 5)
        .text(name);
    }
  }

  redrawPlots() {
    for(let [col, plot] of this.cols)
      plot.redraw();
  }

  getConfigStyle(specifier) {
    return this.configStyle.get(specifier);
  }
}

class Plot {
  constructor(plotGroup, domParent, pkg, col, type) {
    this.plotGroup = plotGroup;
    this.domParent = domParent;
    this.pkg = pkg;
    this.col = col;
    this.type = type;

    this.promise = null;

    this.specifiers = new Map();

    this.outerWidth = 600;
    this.outerHeight = 400;
    this.margin = {top: 80, right: 40, bottom: 60, left: 60};
    this.innerWidth = this.outerWidth - this.margin.left - this.margin.right;
    this.innerHeight = this.outerHeight - this.margin.bottom - this.margin.top;
    this.yOOM = -this.margin.top / 2;
    this.yOOT = -this.margin.top / 4;
    this.container = this.domParent.append("div")
      .style("display", "inline-block")
      .style("border-style", "solid")
      .style("border-width", 1)

    let svg = this.container.append("svg")
      .attr("width", this.outerWidth)
      .attr("height", this.outerHeight);

    this.svg = svg = svg.append("g")
      .attr("transform", "translate(" + this.margin.left + "," + this.margin.top + ")");

    this.setAxisScales();
    // Add the X Axis
    svg.append("g")
      .attr("class", "xAxis")
      .style("font", "1em times")
      .attr("transform", "translate(0," + this.innerHeight + ")")
      .call(d3.axisBottom(this.x))
      .selectAll("text")
      .style("text-anchor", "start")
      .attr("dx", "0.5em")
      .attr("dy", "0.5em")
      .attr("transform", "rotate(45)");

    // Add the Y Axis
    svg.append("g")
      .attr("class", "yAxis")
      .style("font", "1em times")
      .call(g => {
        g.call(d3.axisLeft(this.y));
        let makeTick = (g, text, y) => {
          g = g.append("g").attr("transform", "translate(0," + y + ")");
          g = g.append("g").attr("class", "tick").attr("opacity", 1);
          g.append("line").attr("stroke", "currentColor").attr("x2", -6);
          g.append("text").attr("fill", "currentColor").attr("x", -9).attr("dy", "0.32em").text(text);
        };
        makeTick(g, "OOM", this.yOOM);
        makeTick(g, "OOT", this.yOOT);
      });

    // Add OOM and OOT bars
    let makeBar = y => {
      svg.append("g")
        .attr("class", "ooBar")
        .attr("transform", "translate(0," + y + ")")
        .append("rect")
        .attr("x", 0)
        .attr("y", -2)
        .attr("width", this.innerWidth)
        .attr("height", 4)
        .style("fill", "#CCCCCC");
    };
    makeBar(this.yOOM);
    makeBar(this.yOOT);

    // Axis labels
    svg.append("text")
      .attr("class", "label")
      .attr("transform", "translate(" + this.innerWidth + ", " + this.innerHeight + ")")
      .style("text-anchor", "start")
      .attr("dx", "0.32em").attr("dy", "0.32em")
      .text("n");
    svg.append("text")
      .attr("class", "label")
      .attr("transform", "translate(0, " + -this.margin.top / 4 * 3 + ")")
      .style("text-anchor", "end")
      .text(this.type == "benchmark" ? "Time (s)" : "# Nodes");

    // Plot label
    svg.append("text")
      .attr("class", "label")
      .attr("transform", "translate(" + (this.innerWidth / 2) + ", " + (-this.margin.top / 4 * 3) + ")")
      .style("text-anchor", "middle")
      .style("font-weight", "bold")
      .text(this.col);
    // Close plot
    this.container.append('span')
      .style('float', 'right')
      .html('&times;')
      .style('padding-right', '2px')
      .style("font-size", 20)
      .style('cursor', 'pointer')
      .on('click', () => {
        this.plotGroup.removePlot(pkg, col, type);
      });


    this.redraw();
  }

  setAxisScales() {
    // set the ranges
    this.x = d3.scaleLinear().range([0, this.innerWidth]);
    this.y = d3.scaleLog().range([this.innerHeight, 0]);

    // Scale the range of the data
    let mx = 0;
    let my = 0;
    this.minX = Infinity;
    for(let [specifier, data] of this.specifiers.entries()) {
      mx = Math.max(mx, d3.max(data, d => { return parseInt(d.n); }));
      this.minX = Math.min(this.minX, d3.min(data, d => { return parseInt(d.n); }));
      my = Math.max(my, d3.max(data, d => {
        if(d.y == 'OOM' || d.y == 'OOT') return -Infinity;
        else return parseFloat(d.y);
      }));
    }
    this.x.domain([0, mx]);
    let minY = this.type == "benchmark" ? 0.01 : 1;
    this.y.domain([minY, my]);
  }

  loadData(specifier, redraw=true) {
    let found = false;
    // yes, this is a stupid way to search
    for(let config of this.plotGroup.data[this.pkg][this.col]) {
      if(config.specifier == specifier) {
        found = true;
        break;
      }
    }
    if(!found) return;

    let url = "data/" + this.pkg + "__" + this.col + "__" + specifier + "__" + this.type + ".txt";
    let row = d => {
      if(this.type == "benchmark") return {
        n: d.n,
        y: d.time
      }; else return {
        n: d.n,
        y: d.nodes
      };
    };
    let f = () => {
      return d3.csv(url, row).then(data => {
        this.specifiers.set(specifier, data);
        if(redraw)
          return this.doRedraw();
      });
    };
    if(this.promise) {
      this.promise = this.promise.then(f);
    } else {
      this.promise = f();
    }
  }

  removeData(specifier) {
    this.specifiers.delete(specifier);
    this.redraw();
    this.svg.selectAll(".dot." + specifier)
      .transition()
      .duration(400).delay(d => {
        return (this.x(d.n) - this.minX) / this.innerWidth * 200;
      })
      .attr('transform', d => {
        return 'translate(' + this.x(d.n) + ', ' + this.yOOM + ')';
      })
      .remove();
  }

  redraw() {
    if(this.promise) {
      this.promise = this.promise.then(() => {
        this.doRedraw();
      });
    } else {
      this.doRedraw();
    }
  }

  doRedraw() {
    this.setAxisScales();
    let svg = this.svg;

    // Transition the X Axis
    svg.select("g.xAxis")
      .transition().duration(500)
      .call(d3.axisBottom(this.x))
      .selectAll("text")
      .style("text-anchor", "start")
      .attr("dx", "0.5em")
      .attr("dy", "0.5em")
      .attr("transform", "rotate(45)");

    // Transition the Y Axis
    svg.select("g.yAxis")
      .transition().duration(500)
      .call(t => {
        t.call(d3.axisLeft(this.y));
        let g = t.selection();
        let makeTick = (g, text, y) => {
          g = g.append("g").attr("transform", "translate(0," + y + ")");
          g = g.append("g").attr("class", "tick").attr("opacity", 1);
          g.append("line").attr("stroke", "currentColor").attr("x2", -6);
          g.append("text").attr("fill", "currentColor").attr("x", -9).attr("dy", "0.32em").text(text);
        };
        makeTick(g, "OOM", this.yOOM);
        makeTick(g, "OOT", this.yOOT);
      });


    // Add the scatterplot
    for(let [specifier, data] of this.specifiers.entries()) {
      let style = this.plotGroup.getConfigStyle(specifier);
      let symbol = d3.symbol().size(50).type(getSymbol(style.symbol));

      let withData = svg.selectAll(".dot." + specifier).data(data)
      let getY = d => {
        if(d.y == "OOM") return this.yOOM;
        if(d.y == "OOT") return this.yOOT;
        return this.y(d.y);
      };

      withData.enter().append('path')
        .attr("class", "dot " + specifier)
        .style("fill", "none")
        .style("stroke", style.colour)
        .style("stroke-width", 1.25)
        .attr('d', () => { return symbol(); })
        .attr('transform', d => {
          return 'translate(' + this.x(d.n) + ', '  + this.innerHeight + ')';
        })
        .merge(withData)
        .transition()
        .duration(400).delay(d => {
          return (this.x(d.n) - this.minX) / this.innerWidth * 200;
        })
        .attr('transform', d => {
          return 'translate(' + this.x(d.n) + ', '  + getY(d) + ')';
        });
    }
  }
}

// close dropdowns whne clicking outside them
window.onclick = event => {
  if(!event.target.matches('.dropdown-toggle')) {
    let dropdowns = document.getElementsByClassName("dropdown-menu");
    let i;
    for(i = 0; i < dropdowns.length; i++) {
      let openDropdown = dropdowns[i];
      if(openDropdown.classList.contains('show')) {
        openDropdown.classList.remove('show');
      }
    }
  }
}


$(document).ready(function() {
  let outer = d3.select("body");
  let divFigButtons = outer.append("div");
  let pg = new PlotGroup(outer);
});
