$(document).ready(function(){
  $('.del').on('click',function(e){
    $target= $(e.target);
    const id = $target.attr('data-id');
    $.ajax({
      type: 'DELETE',
      url: '/article/'+id,
      success: function(){
        alert("Deleting Article");
        window.location.href='/';
      },
      error: function(err){
        console.log(err);
      }
    });
  });

  // $(".search").click(function(event)
  // {
  // //  event.preventDefault(); // cancel default behavior
  //
  //
  //
  //   //... rest of add logic
  // });
});
