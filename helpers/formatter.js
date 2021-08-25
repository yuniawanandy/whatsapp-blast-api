const phoneNumberFormatter = function(number) {
    // 1. Menghilangkan karakter selain angka

    let formatted = number.replace(/\D/g, '');

    //Menghilangkan angka 0 diganti dengan 62
    if (formatted.startsWith('0')){
        formatted = '62' + formatted.substr(1);
    }
    if (formatted.startsWith('8')){
        formatted = '62' + formatted;
    }

    if (formatted.startsWith('+')){
        formatted = formatted.substr(1);
    }

    if(!formatted.endsWith('@c.us')){
        formatted += '@c.us';
    }

    return formatted;
}

module.exports = {
    phoneNumberFormatter
}
