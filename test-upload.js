// ============================================================
// 在浏览器控制台运行此代码测试上传功能
// 使用方法：打开 https://95388.cn.mt/admin，按F12，粘贴运行
// ============================================================

(async function testUpload() {
  console.log('=== 开始测试上传功能 ===');
  
  // 测试Storage上传
  console.log('\n1. 测试Storage上传...');
  try {
    const testFile = new Blob(['test'], { type: 'text/plain' });
    const { data, error } = await window.rechargeClient.storage
      .from('screenshots')
      .upload('test-debug.txt', testFile, { upsert: false });
    
    if (error) {
      console.error('❌ Storage上传失败:', error);
      return;
    }
    console.log('✅ Storage上传成功:', data);
  } catch (e) {
    console.error('❌ Storage上传异常:', e);
  }
  
  // 测试数据库访问
  console.log('\n2. 测试数据库访问...');
  try {
    const { data, error } = await window.chatClient
      .from('settings')
      .select('*')
      .eq('id', 'default')
      .maybeSingle();
    
    if (error) {
      console.error('❌ 数据库查询失败:', error);
      console.error('错误详情:', JSON.stringify(error, null, 2));
      return;
    }
    console.log('✅ 数据库查询成功:', data);
  } catch (e) {
    console.error('❌ 数据库查询异常:', e);
  }
  
  // 测试插入数据
  console.log('\n3. 测试数据插入...');
  try {
    const testSettings = {
      id: 'test_debug',
      logo: 'https://example.com/test.png',
      app_name: '测试',
      subtitle: '测试副标题',
      welcome_text: '测试欢迎语',
      updated_at: new Date().toISOString()
    };
    
    const { data, error } = await window.chatClient
      .from('settings')
      .upsert(testSettings, { onConflict: 'id' });
    
    if (error) {
      console.error('❌ 数据插入失败:', error);
      console.error('错误详情:', JSON.stringify(error, null, 2));
      return;
    }
    console.log('✅ 数据插入成功:', data);
  } catch (e) {
    console.error('❌ 数据插入异常:', e);
  }
  
  console.log('\n=== 测试完成 ===');
})();
