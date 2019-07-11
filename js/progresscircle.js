function makesvg(percentage, inner_text = "") {

    percentage *= 100;

    let abs_percentage = Math.abs(percentage).toString();
    let percentage_str = percentage.toString();
    let classes = "";

    var svg = '<svg class="circle-chart" viewbox="0 0 33.83098862 33.83098862" xmlns="http://www.w3.org/2000/svg">'
        + '<circle class="circle-chart__background" cx="16.9" cy="16.9" r="15.9" />'
        + '<circle class="circle-chart__circle"'
        + 'stroke-dasharray="' + abs_percentage + ',100"    cx="16.9" cy="16.9" r="15.9" />'
        + '<g class="circle-chart__info">'
        + '<text class="circle-chart__percent" x="16.8" y="15.5" fill="#CCF5FF">' + inner_text + '</text>'
        + '<text class="circle-chart__subline" x="16.91549431" y="25" fill="#CCF5FF">COMPUTING POWER</text>'
        + ' </g></svg>';

    return svg
}

(function ($) {

    $.fn.circlechart = function (percentage) {
        this.each(function () {
            let percentage = $(this).data("percentage");
            let inner_text = $(this).text();
            $(this).html(makesvg(percentage, inner_text));
        });
        return this;
    };

}(jQuery));