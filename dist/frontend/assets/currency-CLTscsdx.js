const t=(t,N="INR")=>{const e=Number(t);return isNaN(e)||null==e?"INR"===N?"₹0.00":"$0.00":"INR"===N?`₹${e.toFixed(2)}`:`$${e.toFixed(2)}`};export{t as f};
