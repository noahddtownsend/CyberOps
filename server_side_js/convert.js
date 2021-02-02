module.exports = {

    idNumberToLetter: function (i) {
        switch (i) {
            case 0:
                return 'A';
            case 1:
                return 'B';
            case 2:
                return 'C';
            case 3:
                return 'D';
        }
    },

    idLetterToNumber: function (letter) {
        switch (letter.toUpperCase()) {
            case 'A':
                return 0;
            case 'B':
                return 1;
            case 'C':
                return 2;
            case 'D':
                return 3;
        }
    }
}